/*
 * Copyright (c) 2023 James Westman
 *
 * GNOME Maps is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * GNOME Maps is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: James Westman <james@jwestman.net>
 */

#include <sqlite3.h>
#include <json-glib/json-glib.h>

#include "maps-download-store.h"

struct _MapsDownloadStore {
  GObject parent_instance;

  char *path;
  sqlite3 *db;

  /* Note: Tasks are run in threads so they don't block the UI thread, not so that multiple tasks can run in parallel.
     All tasks are serialized using this mutex. */
  GMutex mutex;
};

G_DEFINE_TYPE (MapsDownloadStore, maps_download_store, G_TYPE_OBJECT)

typedef char sqlite_str;
G_DEFINE_AUTOPTR_CLEANUP_FUNC (sqlite_str, sqlite3_free);
G_DEFINE_AUTOPTR_CLEANUP_FUNC (sqlite3_stmt, sqlite3_finalize);

#define RETURN_IF_SQLITE_ERROR(status, task, format, ...) \
  do { \
    if ((status) != SQLITE_OK) { \
      g_task_return_new_error (task, G_IO_ERROR, G_IO_ERROR_FAILED, format, ##__VA_ARGS__); \
      return; \
    } \
  } while (0)

#define RETURN_IF_PREPARE_ERROR(status, task) \
  RETURN_IF_SQLITE_ERROR (status, task, "Failed to prepare statement: %s", sqlite3_errstr (status))

#define RETURN_IF_BIND_ERROR(status, task, param) \
  RETURN_IF_SQLITE_ERROR (status, task, "Failed to bind %s: %s", (param), sqlite3_errstr (status))

#define RETURN_IF_NOT_DONE(status, task, format, ...) \
  do { \
    if ((status) != SQLITE_DONE) { \
      g_task_return_new_error (task, G_IO_ERROR, G_IO_ERROR_FAILED, format, ##__VA_ARGS__); \
      return; \
    } \
  } while (0)

static void
maps_download_store_finalize (GObject *object)
{
  MapsDownloadStore *self = MAPS_DOWNLOAD_STORE (object);
  int status;

  g_clear_pointer (&self->path, g_free);

  status = sqlite3_close (self->db);
  if (status != SQLITE_OK)
    g_critical ("Failed to close downloads database: %s", sqlite3_errstr (status));

  g_mutex_clear (&self->mutex);

  G_OBJECT_CLASS (maps_download_store_parent_class)->finalize (object);
}

static void
maps_download_store_class_init (MapsDownloadStoreClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->finalize = maps_download_store_finalize;
}

static void
maps_download_store_init (MapsDownloadStore *self)
{
  g_mutex_init (&self->mutex);
}

MapsDownloadStore *
maps_download_store_new (void)
{
  return g_object_new (MAPS_TYPE_DOWNLOAD_STORE, NULL);
}

gboolean
maps_download_store_open (MapsDownloadStore  *self,
                          const char         *path,
                          GError            **error)
{
  int status;
  g_autoptr(sqlite_str) error_msg = NULL;

  g_return_val_if_fail (MAPS_IS_DOWNLOAD_STORE (self), FALSE);
  g_return_val_if_fail (path != NULL, FALSE);
  g_return_val_if_fail (self->db == NULL, FALSE);

  status = sqlite3_open_v2 (path, &self->db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, NULL);

  if (status != SQLITE_OK)
    {
      g_set_error (error, G_IO_ERROR, G_IO_ERROR_FAILED, "Failed to open database: %s", sqlite3_errstr (status));
      g_clear_pointer (&self->db, sqlite3_close);
      return FALSE;
    }

  sqlite3_exec (
    self->db,
    "CREATE TABLE IF NOT EXISTS tiles ("
    "  tileset TEXT,"
    "  id TEXT,"
    "  bytes BLOB,"
    "  mtime INTEGER,"
    "  PRIMARY KEY (tileset, id)"
    ");"
    "CREATE TABLE IF NOT EXISTS metadata ("
    "  key TEXT PRIMARY KEY,"
    "  value TEXT"
    ");"
    "INSERT INTO metadata (key, value) VALUES ('version', '1')"
    "  ON CONFLICT (key) DO UPDATE SET value = excluded.value;",
    NULL, NULL, &error_msg
  );
  if (error_msg != NULL)
    {
      g_set_error (error, G_IO_ERROR, G_IO_ERROR_FAILED, "Failed to initialize database schema: %s", error_msg);
      g_clear_pointer (&self->db, sqlite3_close);
      return FALSE;
    }

  self->path = g_strdup (path);

  return TRUE;
}

typedef struct {
  char *tileset;
  char **ids;
  GBytes *bytes;
  gboolean precompressed;
  guint64 mtime;
} InsertData;

static void
insert_data_free (InsertData *data)
{
  g_clear_pointer (&data->tileset, g_free);
  g_clear_pointer (&data->ids, g_strfreev);
  g_clear_pointer (&data->bytes, g_bytes_unref);
  g_free (data);
}

static GBytes *
compress (GBytes  *bytes,
          GError **error)
{
  g_autoptr(GZlibCompressor) compressor = g_zlib_compressor_new (G_ZLIB_COMPRESSOR_FORMAT_GZIP, 9);
  g_autoptr(GInputStream) input = g_memory_input_stream_new_from_bytes (bytes);
  g_autoptr(GInputStream) converter = g_converter_input_stream_new (input, G_CONVERTER (compressor));
  g_autoptr(GOutputStream) output = g_memory_output_stream_new_resizable ();
  gssize result;

  result = g_output_stream_splice (output, converter, G_OUTPUT_STREAM_SPLICE_CLOSE_SOURCE | G_OUTPUT_STREAM_SPLICE_CLOSE_TARGET, NULL, error);
  if (result < 0)
    return NULL;

  return g_memory_output_stream_steal_as_bytes (G_MEMORY_OUTPUT_STREAM (output));
}

static GBytes *
decompress (GBytes  *bytes,
            GError **error)
{
  g_autoptr(GZlibDecompressor) compressor = g_zlib_decompressor_new (G_ZLIB_COMPRESSOR_FORMAT_GZIP);
  g_autoptr(GInputStream) input = g_memory_input_stream_new_from_bytes (bytes);
  g_autoptr(GInputStream) converter = g_converter_input_stream_new (input, G_CONVERTER (compressor));
  g_autoptr(GOutputStream) output = g_memory_output_stream_new_resizable ();
  gssize result;

  result = g_output_stream_splice (output, converter, G_OUTPUT_STREAM_SPLICE_CLOSE_SOURCE | G_OUTPUT_STREAM_SPLICE_CLOSE_TARGET, NULL, error);
  if (result < 0)
    return NULL;

  return g_memory_output_stream_steal_as_bytes (G_MEMORY_OUTPUT_STREAM (output));
}

static void
do_insert (GTask        *task,
           gpointer      source_object,
           gpointer      task_data,
           GCancellable *cancellable)
{
  MapsDownloadStore *self = MAPS_DOWNLOAD_STORE (source_object);
  InsertData *data = task_data;
  g_autoptr(sqlite3_stmt) stmt = NULL;
  g_autoptr(GBytes) bytes = NULL;
  g_autoptr(GError) error = NULL;
  int status;

  G_MUTEX_AUTO_LOCK (&self->mutex, locker);

  if (data->precompressed)
    bytes = g_bytes_ref (data->bytes);
  else
    {
      bytes = compress (data->bytes, &error);
      if (bytes == NULL)
        {
          g_task_return_error (task, g_steal_pointer (&error));
          return;
        }
    }

  status = sqlite3_prepare_v2 (
    self->db,
    "INSERT INTO tiles (tileset, id, bytes, mtime) VALUES (?, ?, ?, ?)"
    "  ON CONFLICT (tileset, id) DO UPDATE SET bytes = excluded.bytes, mtime = excluded.mtime",
    -1,
    &stmt,
    NULL
  );
  RETURN_IF_PREPARE_ERROR (status, task);

  status = sqlite3_bind_text (stmt, 1, data->tileset, -1, SQLITE_STATIC);
  RETURN_IF_BIND_ERROR (status, task, "tileset");

  status = sqlite3_bind_blob (stmt, 3, g_bytes_get_data (bytes, NULL), g_bytes_get_size (bytes), SQLITE_STATIC);
  RETURN_IF_BIND_ERROR (status, task, "data");

  status = sqlite3_bind_int64 (stmt, 4, data->mtime);
  RETURN_IF_BIND_ERROR (status, task, "mtime");

  for (int i = 0; data->ids[i] != NULL; i++)
    {
      status = sqlite3_bind_text (stmt, 2, data->ids[i], -1, SQLITE_STATIC);
      RETURN_IF_BIND_ERROR (status, task, "id");

      status = sqlite3_step (stmt);
      RETURN_IF_NOT_DONE (status, task, "Failed to insert data: %s", sqlite3_errstr (status));

      sqlite3_reset (stmt);
    }

  g_task_return_boolean (task, TRUE);
}

/**
 * maps_download_store_insert_async:
 * @ids: (array zero-terminated=1):
 */
void
maps_download_store_insert_async (MapsDownloadStore    *self,
                                  const char           *tileset,
                                  const char          **ids,
                                  GBytes               *data,
                                  gboolean              precompressed,
                                  guint64               mtime,
                                  GAsyncReadyCallback   callback,
                                  gpointer              user_data)
{
  g_autoptr(GTask) task = NULL;
  InsertData *insert_data;

  g_return_if_fail (MAPS_IS_DOWNLOAD_STORE (self));
  g_return_if_fail (ids != NULL);
  g_return_if_fail (data != NULL);

  task = g_task_new (self, NULL, callback, user_data);
  g_task_set_source_tag (task, maps_download_store_insert_async);

  insert_data = g_new (InsertData, 1);
  insert_data->tileset = g_strdup (tileset);
  insert_data->ids = g_strdupv ((char **)ids);
  insert_data->bytes = g_bytes_ref (data);
  insert_data->precompressed = precompressed;
  insert_data->mtime = mtime;
  g_task_set_task_data (task, insert_data, (GDestroyNotify)insert_data_free);

  g_task_run_in_thread (task, do_insert);
}

gboolean
maps_download_store_insert_finish (MapsDownloadStore  *self,
                                   GAsyncResult       *result,
                                   GError            **error)
{
  g_return_val_if_fail (MAPS_IS_DOWNLOAD_STORE (self), FALSE);
  g_return_val_if_fail (g_task_is_valid (result, self), FALSE);

  return g_task_propagate_boolean (G_TASK (result), error);
}

typedef struct {
  char *tileset;
  char **ids;
} RemoveData;

static void
remove_data_free (RemoveData *data)
{
  g_clear_pointer (&data->tileset, g_free);
  g_clear_pointer (&data->ids, g_strfreev);
  g_free (data);
}

static void
do_remove (GTask        *task,
           gpointer      source_object,
           gpointer      task_data,
           GCancellable *cancellable)
{
  MapsDownloadStore *self = MAPS_DOWNLOAD_STORE (source_object);
  RemoveData *data = task_data;
  g_autoptr(sqlite3_stmt) stmt = NULL;
  int status;

  G_MUTEX_AUTO_LOCK (&self->mutex, locker);

  status = sqlite3_prepare_v2 (
    self->db,
    "DELETE FROM tiles WHERE tileset = ? and id = ?",
    -1,
    &stmt,
    NULL
  );
  RETURN_IF_PREPARE_ERROR (status, task);

  status = sqlite3_bind_text (stmt, 1, data->tileset, -1, SQLITE_STATIC);
  RETURN_IF_BIND_ERROR (status, task, "tileset");

  for (int i = 0; data->ids[i] != NULL; i++)
    {
      status = sqlite3_bind_text (stmt, 2, data->ids[i], -1, SQLITE_STATIC);
      RETURN_IF_BIND_ERROR (status, task, "id");

      status = sqlite3_step (stmt);
      RETURN_IF_NOT_DONE (status, task, "Failed to remove data: %s", sqlite3_errstr (status));

      sqlite3_reset (stmt);
    }

  g_task_return_boolean (task, TRUE);
}

/**
 * maps_download_store_remove_async:
 * @ids: (array zero-terminated=1):
 */
void
maps_download_store_remove_async (MapsDownloadStore    *self,
                                  const char           *tileset,
                                  const char          **ids,
                                  GAsyncReadyCallback   callback,
                                  gpointer              user_data)
{
  g_autoptr(GTask) task = NULL;
  RemoveData *data;

  g_return_if_fail (MAPS_IS_DOWNLOAD_STORE (self));
  g_return_if_fail (ids != NULL);

  task = g_task_new (self, NULL, callback, user_data);
  g_task_set_source_tag (task, maps_download_store_remove_async);

  data = g_new (RemoveData, 1);
  data->tileset = g_strdup (tileset);
  data->ids = g_strdupv ((char **)ids);
  g_task_set_task_data (task, data, (GDestroyNotify)remove_data_free);
  g_task_run_in_thread (task, do_remove);
}

gboolean
maps_download_store_remove_finish (MapsDownloadStore  *self,
                                   GAsyncResult       *result,
                                   GError            **error)
{
  g_return_val_if_fail (MAPS_IS_DOWNLOAD_STORE (self), FALSE);
  g_return_val_if_fail (g_task_is_valid (result, self), FALSE);

  return g_task_propagate_boolean (G_TASK (result), error);
}

typedef struct {
  char *tileset;
  char *id;
} GetData;

static void
get_data_free (GetData *data)
{
  g_clear_pointer (&data->tileset, g_free);
  g_clear_pointer (&data->id, g_free);
  g_free (data);
}

static void
do_get (GTask        *task,
        gpointer      source_object,
        gpointer      task_data,
        GCancellable *cancellable)
{
  MapsDownloadStore *self = MAPS_DOWNLOAD_STORE (source_object);
  GetData *data = task_data;
  g_autoptr(sqlite3_stmt) stmt = NULL;
  GError *error = NULL;
  int status;

  G_MUTEX_AUTO_LOCK (&self->mutex, locker);

  status = sqlite3_prepare_v2 (
    self->db,
    "SELECT bytes FROM tiles WHERE tileset = ? and id = ?",
    -1,
    &stmt,
    NULL
  );
  RETURN_IF_PREPARE_ERROR (status, task);

  sqlite3_bind_text (stmt, 1, data->tileset, -1, SQLITE_STATIC);
  RETURN_IF_BIND_ERROR (status, task, "tileset");

  sqlite3_bind_text (stmt, 2, data->id, -1, SQLITE_STATIC);
  RETURN_IF_BIND_ERROR (status, task, "id");

  status = sqlite3_step (stmt);
  if (status == SQLITE_DONE)
    g_task_return_pointer (task, NULL, NULL);
  else if (status == SQLITE_ROW)
    {
      g_autoptr(GBytes) bytes = g_bytes_new (
        sqlite3_column_blob (stmt, 0),
        sqlite3_column_bytes (stmt, 0)
      );
      GBytes *decompressed = decompress (bytes, &error);

      if (decompressed == NULL)
        {
          g_task_return_error (task, error);
          return;
        }

      g_task_return_pointer (task, decompressed, (GDestroyNotify)g_bytes_unref);
    }
  else
    g_task_return_new_error (task, G_IO_ERROR, G_IO_ERROR_FAILED, "Failed to get data: %s", sqlite3_errstr (status));
}

void
maps_download_store_get_async (MapsDownloadStore   *self,
                               const char          *tileset,
                               const char          *id,
                               GAsyncReadyCallback  callback,
                               gpointer             user_data)
{
  g_autoptr(GTask) task = NULL;
  GetData *data;

  g_return_if_fail (MAPS_IS_DOWNLOAD_STORE (self));
  g_return_if_fail (id != NULL);

  task = g_task_new (self, NULL, callback, user_data);
  g_task_set_source_tag (task, maps_download_store_get_async);

  data = g_new (GetData, 1);
  data->tileset = g_strdup (tileset);
  data->id = g_strdup (id);
  g_task_set_task_data (task, data, (GDestroyNotify)get_data_free);
  g_task_run_in_thread (task, do_get);
}

/**
 * maps_download_store_get_finish:
 * @self: a [class@DownloadStore]
 * @result: a [class@Gio.AsyncResult]
 * @error: return location for a [class@GError]
 *
 * Finishes a get_async() operation.
 *
 * Returns: (transfer full) (nullable): the data, or %NULL if the data was not found
 * or an error occurred
 */
GBytes *
maps_download_store_get_finish (MapsDownloadStore  *self,
                                GAsyncResult       *result,
                                GError            **error)
{
  g_return_val_if_fail (MAPS_IS_DOWNLOAD_STORE (self), NULL);
  g_return_val_if_fail (g_task_is_valid (result, self), NULL);

  return g_task_propagate_pointer (G_TASK (result), error);
}

static void
do_exec (GTask        *task,
           gpointer      source_object,
           gpointer      task_data,
           GCancellable *cancellable)
{
  MapsDownloadStore *self = MAPS_DOWNLOAD_STORE (source_object);
  const char *sql = task_data;
  int status;

  G_MUTEX_AUTO_LOCK (&self->mutex, locker);

  status = sqlite3_exec (self->db, sql, NULL, NULL, NULL);
  if (status != SQLITE_OK)
    g_task_return_new_error (task, G_IO_ERROR, G_IO_ERROR_FAILED, "Failed to execute `%s`: %s", sql, sqlite3_errstr (status));
  else
    g_task_return_boolean (task, TRUE);
}

/**
 * maps_download_store_exec_async:
 * @self: a [class@DownloadStore]
 * @sql: SQL statement to execute
 * @callback: a [callback@Gio.AsyncReadyCallback]
 * @user_data: user data passed to @callback
 *
 * Asynchronously executes a SQL statement.
 */
void
maps_download_store_exec_async (MapsDownloadStore   *self,
                                const char          *sql,
                                GAsyncReadyCallback  callback,
                                gpointer             user_data)
{
  g_autoptr(GTask) task = NULL;

  G_MUTEX_AUTO_LOCK (&self->mutex, locker);

  task = g_task_new (self, NULL, callback, user_data);
  g_task_set_source_tag (task, maps_download_store_exec_async);
  g_task_set_task_data (task, g_strdup (sql), g_free);

  g_task_run_in_thread (task, do_exec);
}

/**
 * maps_download_store_exec_finish:
 * @self: a [class@DownloadStore]
 *
 * Finishes an exec_async() operation.
 *
 * Returns: %TRUE if the operation succeeded, %FALSE otherwise
 */
gboolean
maps_download_store_exec_finish (MapsDownloadStore  *self,
                                   GAsyncResult     *result,
                                   GError          **error)
{
  g_return_val_if_fail (MAPS_IS_DOWNLOAD_STORE (self), FALSE);
  g_return_val_if_fail (g_task_is_valid (result, self), FALSE);

  return g_task_propagate_boolean (G_TASK (result), error);
}

static void
do_list_tilesets (GTask        *task,
                  gpointer      source_object,
                  gpointer      task_data,
                  GCancellable *cancellable)
{
  MapsDownloadStore *self = MAPS_DOWNLOAD_STORE (source_object);
  g_autoptr(sqlite3_stmt) stmt = NULL;
  g_autoptr(GStrvBuilder) builder = g_strv_builder_new ();
  int status;

  G_MUTEX_AUTO_LOCK (&self->mutex, locker);

  status = sqlite3_prepare_v2 (
    self->db,
    "SELECT DISTINCT tileset FROM tiles",
    -1,
    &stmt,
    NULL
  );
  RETURN_IF_PREPARE_ERROR (status, task);

  while ((status = sqlite3_step (stmt)) == SQLITE_ROW)
    g_strv_builder_add (builder, (const char *)sqlite3_column_text (stmt, 0));

  g_task_return_pointer (task, g_strv_builder_end (builder), (GDestroyNotify)g_strfreev);
}

void
maps_download_store_list_tilesets_async (MapsDownloadStore    *self,
                                         GAsyncReadyCallback   callback,
                                         gpointer              user_data)
{
  g_autoptr(GTask) task = NULL;

  g_return_if_fail (MAPS_IS_DOWNLOAD_STORE (self));

  task = g_task_new (self, NULL, callback, user_data);
  g_task_set_source_tag (task, maps_download_store_list_tilesets_async);

  g_task_run_in_thread (task, do_list_tilesets);
}

/**
 * maps_download_store_list_tilesets_finish:
 * Returns: (transfer full):
 */
char **
maps_download_store_list_tilesets_finish (MapsDownloadStore  *self,
                                          GAsyncResult       *result,
                                          GError            **error)
{
  g_return_val_if_fail (MAPS_IS_DOWNLOAD_STORE (self), NULL);
  g_return_val_if_fail (g_task_is_valid (result, self), NULL);

  return g_task_propagate_pointer (G_TASK (result), error);
}

static void
do_list_tiles (GTask        *task,
               gpointer      source_object,
               gpointer      task_data,
               GCancellable *cancellable)
{
  MapsDownloadStore *self = MAPS_DOWNLOAD_STORE (source_object);
  const char *tileset = task_data;
  g_autoptr(sqlite3_stmt) stmt = NULL;
  g_autoptr(GStrvBuilder) builder = g_strv_builder_new ();
  int status;

  G_MUTEX_AUTO_LOCK (&self->mutex, locker);

  status = sqlite3_prepare_v2 (
    self->db,
    "SELECT id FROM tiles WHERE tileset = ?",
    -1,
    &stmt,
    NULL
  );
  RETURN_IF_PREPARE_ERROR (status, task);

  status = sqlite3_bind_text (stmt, 1, tileset, -1, SQLITE_STATIC);
  RETURN_IF_BIND_ERROR (status, task, "tileset");

  while ((status = sqlite3_step (stmt)) == SQLITE_ROW)
    g_strv_builder_add (builder, (const char *)sqlite3_column_text (stmt, 0));

  g_task_return_pointer (task, g_strv_builder_end (builder), (GDestroyNotify)g_strfreev);
}

void
maps_download_store_list_tiles_async (MapsDownloadStore    *self,
                                      const char           *tileset,
                                      GAsyncReadyCallback   callback,
                                      gpointer              user_data)
{
  g_autoptr(GTask) task = NULL;
  g_autofree char *tileset_dup = g_strdup (tileset);

  g_return_if_fail (MAPS_IS_DOWNLOAD_STORE (self));
  g_return_if_fail (tileset != NULL);

  task = g_task_new (self, NULL, callback, user_data);
  g_task_set_source_tag (task, maps_download_store_list_tiles_async);
  g_task_set_task_data (task, g_steal_pointer (&tileset_dup), g_free);

  g_task_run_in_thread (task, do_list_tiles);
}

/**
 * maps_download_store_list_tiles_finish:
 * Returns: (transfer full):
 */
char **
maps_download_store_list_tiles_finish (MapsDownloadStore  *self,
                                       GAsyncResult       *result,
                                       GError            **error)
{
  g_return_val_if_fail (MAPS_IS_DOWNLOAD_STORE (self), NULL);
  g_return_val_if_fail (g_task_is_valid (result, self), NULL);

  return g_task_propagate_pointer (G_TASK (result), error);
}

typedef struct {
  char *tileset;
  char **ids;
  guint64 mtime;
} TileQueryData;

static void
tile_query_data_free (TileQueryData *data)
{
  g_clear_pointer (&data->tileset, g_free);
  g_clear_pointer (&data->ids, g_strfreev);
  g_free (data);
}

static void
do_compute_size (GTask        *task,
                 gpointer      source_object,
                 gpointer      task_data,
                 GCancellable *cancellable)
{
  MapsDownloadStore *self = MAPS_DOWNLOAD_STORE (source_object);
  TileQueryData *data = task_data;
  g_autoptr(sqlite3_stmt) stmt = NULL;
  int status;
  gssize total_size = 0;

  G_MUTEX_AUTO_LOCK (&self->mutex, locker);

  status = sqlite3_prepare_v2 (
    self->db,
    "SELECT length(bytes) FROM tiles WHERE tileset = ? and id = ?",
    -1,
    &stmt,
    NULL
  );
  RETURN_IF_PREPARE_ERROR (status, task);

  status = sqlite3_bind_text (stmt, 1, data->tileset, -1, SQLITE_STATIC);
  RETURN_IF_BIND_ERROR (status, task, "tileset");

  for (int i = 0; data->ids[i] != NULL; i++)
    {
      status = sqlite3_bind_text (stmt, 2, data->ids[i], -1, SQLITE_STATIC);
      RETURN_IF_BIND_ERROR (status, task, "id");

      status = sqlite3_step (stmt);
      if (status == SQLITE_ROW)
        total_size += sqlite3_column_int64 (stmt, 0);
      else if (status != SQLITE_DONE)
        {
          g_task_return_new_error (task, G_IO_ERROR, G_IO_ERROR_FAILED, "Failed to compute size: %s", sqlite3_errstr (status));
          return;
        }

      sqlite3_reset (stmt);
    }

  g_task_return_int (task, total_size);
}

/**
 * maps_download_store_compute_size_async:
 * @tile_ids: (array zero-terminated=1):
 */
void
maps_download_store_compute_size_async (MapsDownloadStore    *self,
                                        const char           *tileset,
                                        const char          **tile_ids,
                                        GAsyncReadyCallback   callback,
                                        gpointer              user_data)
{
  g_autoptr(GTask) task = NULL;
  TileQueryData *data = NULL;

  g_return_if_fail (MAPS_IS_DOWNLOAD_STORE (self));
  g_return_if_fail (tileset != NULL);
  g_return_if_fail (tile_ids != NULL);

  task = g_task_new (self, NULL, callback, user_data);
  g_task_set_source_tag (task, maps_download_store_compute_size_async);

  data = g_new0 (TileQueryData, 1);
  data->tileset = g_strdup (tileset);
  data->ids = g_strdupv ((char **)tile_ids);
  g_task_set_task_data (task, data, (GDestroyNotify)tile_query_data_free);

  g_task_run_in_thread (task, do_compute_size);
}

gsize
maps_download_store_compute_size_finish (MapsDownloadStore  *self,
                                         GAsyncResult       *result,
                                         GError            **error)
{
  g_return_val_if_fail (MAPS_IS_DOWNLOAD_STORE (self), 0);
  g_return_val_if_fail (g_task_is_valid (result, self), 0);

  return g_task_propagate_int (G_TASK (result), error);
}

static void
do_filter_by_mtime (GTask        *task,
                    gpointer      source_object,
                    gpointer      task_data,
                    GCancellable *cancellable)
{
  MapsDownloadStore *self = MAPS_DOWNLOAD_STORE (source_object);
  TileQueryData *data = task_data;
  g_autoptr(sqlite3_stmt) stmt = NULL;
  g_autoptr(GStrvBuilder) builder = g_strv_builder_new ();
  int status;

  G_MUTEX_AUTO_LOCK (&self->mutex, locker);

  status = sqlite3_prepare_v2 (
    self->db,
    "SELECT id FROM tiles WHERE tileset = ? AND id = ? AND mtime > ?",
    -1,
    &stmt,
    NULL
  );
  RETURN_IF_PREPARE_ERROR (status, task);

  status = sqlite3_bind_text (stmt, 1, data->tileset, -1, SQLITE_STATIC);
  RETURN_IF_BIND_ERROR (status, task, "tileset");

  status = sqlite3_bind_int64 (stmt, 3, data->mtime);
  RETURN_IF_BIND_ERROR (status, task, "mtime");

  for (int i = 0; data->ids[i] != NULL; i++)
    {
      status = sqlite3_bind_text (stmt, 2, data->ids[i], -1, SQLITE_STATIC);
      RETURN_IF_BIND_ERROR (status, task, "id");

      status = sqlite3_step (stmt);
      if (status == SQLITE_ROW)
        g_strv_builder_add (builder, (const char *)sqlite3_column_text (stmt, 0));
      else if (status != SQLITE_DONE)
        {
          g_task_return_new_error (task, G_IO_ERROR, G_IO_ERROR_FAILED, "Failed to filter by mtime: %s", sqlite3_errstr (status));
          return;
        }

      sqlite3_reset (stmt);
    }

  g_task_return_pointer (task, g_strv_builder_end (builder), (GDestroyNotify)g_strfreev);
}

/**
 * maps_download_store_filter_by_mtime_async:
 * @tile_ids: (array zero-terminated=1):
 */
void
maps_download_store_filter_by_mtime_async (MapsDownloadStore    *self,
                                           const char           *tileset,
                                           const char          **tile_ids,
                                           guint64               mtime,
                                           GAsyncReadyCallback   callback,
                                           gpointer              user_data)
{
  g_autoptr(GTask) task = NULL;
  TileQueryData *data = NULL;

  g_return_if_fail (MAPS_IS_DOWNLOAD_STORE (self));
  g_return_if_fail (tileset != NULL);
  g_return_if_fail (tile_ids != NULL);

  task = g_task_new (self, NULL, callback, user_data);
  g_task_set_source_tag (task, maps_download_store_filter_by_mtime_async);

  data = g_new0 (TileQueryData, 1);
  data->tileset = g_strdup (tileset);
  data->ids = g_strdupv ((char **)tile_ids);
  data->mtime = mtime;
  g_task_set_task_data (task, data, (GDestroyNotify)tile_query_data_free);

  g_task_run_in_thread (task, do_filter_by_mtime);
}

/**
 * maps_download_store_filter_by_mtime_finish:
 * Returns: (transfer full):
 */
char **
maps_download_store_filter_by_mtime_finish (MapsDownloadStore  *self,
                                            GAsyncResult       *result,
                                            GError            **error)
{
  g_return_val_if_fail (MAPS_IS_DOWNLOAD_STORE (self), NULL);
  g_return_val_if_fail (g_task_is_valid (result, self), NULL);

  return g_task_propagate_pointer (G_TASK (result), error);
}
