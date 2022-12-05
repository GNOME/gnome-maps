/*
 * Copyright (c) 2015 Jonas Danielsson
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
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

#include <shumate/shumate.h>
#include <gio/gio.h>
#include <glib.h>
#include <glib-object.h>
#include <libsoup/soup.h>
#include <stdlib.h>

#include "mapsintl.h"
#include "maps-file-data-source.h"

#define MAPS_FILE_DATA_SOURCE_ERROR maps_file_data_source_error_quark ()

GQuark
maps_file_data_source_error_quark (void)
{
  return g_quark_from_static_string ("maps-file-data-source-error");
}

enum {
  PROP_0,

  PROP_PATH,
  PROP_MAX_ZOOM,
  PROP_MIN_ZOOM
};

struct _MapsFileDataSourcePrivate
{
  gchar *path;
  gchar *extension;
  gint max_zoom;
  gint min_zoom;

  long min_x;
  long min_y;
  long max_x;
  long max_y;
};

G_DEFINE_TYPE_WITH_PRIVATE (MapsFileDataSource, maps_file_data_source, SHUMATE_TYPE_DATA_SOURCE)

static void
maps_file_data_source_set_property (GObject      *object,
                                    guint         prop_id,
                                    const GValue *value,
                                    GParamSpec   *pspec)
{
  MapsFileDataSource *data_source = MAPS_FILE_DATA_SOURCE (object);

  switch (prop_id)
    {
    case PROP_PATH:
      data_source->priv->path = g_strdup ((char *) g_value_get_string (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_file_data_source_get_property (GObject *object,
    guint prop_id,
    GValue *value,
    GParamSpec *pspec)
{
  MapsFileDataSource *data_source = MAPS_FILE_DATA_SOURCE (object);

  switch (prop_id)
    {
    case PROP_PATH:
      g_value_set_string (value, data_source->priv->path);
      break;

    case PROP_MIN_ZOOM:
      g_value_set_uint (value, data_source->priv->min_zoom);
      break;

    case PROP_MAX_ZOOM:
      g_value_set_uint (value, data_source->priv->max_zoom);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_file_data_source_dispose (GObject *object)
{
  G_OBJECT_CLASS (maps_file_data_source_parent_class)->dispose (object);
}

static void
maps_file_data_source_finalize (GObject *object)
{
  MapsFileDataSource *data_source = MAPS_FILE_DATA_SOURCE (object);

  if (data_source->priv->path)
    g_free (data_source->priv->path);

  if (data_source->priv->extension)
    g_free (data_source->priv->extension);

  G_OBJECT_CLASS (maps_file_data_source_parent_class)->finalize (object);
}

static void
get_tile_data_async (ShumateDataSource     *source,
                     int x,
                     int y,
                     int zoom_level,
                     GCancellable         *cancellable,
                     GAsyncReadyCallback   callback,
                     gpointer              user_data);

static void
maps_file_data_source_class_init (MapsFileDataSourceClass *klass)
{
  ShumateDataSourceClass *data_source_class = SHUMATE_DATA_SOURCE_CLASS (klass);
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  GParamSpec *pspec;

  object_class->finalize = maps_file_data_source_finalize;
  object_class->dispose = maps_file_data_source_dispose;
  object_class->get_property = maps_file_data_source_get_property;
  object_class->set_property = maps_file_data_source_set_property;
  data_source_class->get_tile_data_async = get_tile_data_async;

  /**
   * MapsFileDataSource:path:
   *
   * The path to the tile source.
   *
   */
  pspec = g_param_spec_string ("path",
                               "Path",
                               "The path to the tile source",
                               "",
                               G_PARAM_READWRITE | G_PARAM_CONSTRUCT);
  g_object_class_install_property (object_class, PROP_PATH, pspec);

  /**
   * MapsFileDataSource:min-zoom:
   *
   * The minimum zoom level of the tile source.
   *
   */
  pspec = g_param_spec_uint ("min-zoom",
                             "Minimum zoom",
                             "The minimum zoom level of the tile source",
                             0,
                             20,
                             2,
                             G_PARAM_READABLE);
  g_object_class_install_property (object_class, PROP_MIN_ZOOM, pspec);

  /**
   * MapsFileDataSource:max-zoom:
   *
   * The maximum zoom level of the tile source.
   *
   */
  pspec = g_param_spec_uint ("max-zoom",
                             "Maximum zoom",
                             "The maximum zoom level of the tile source",
                             0,
                             20,
                             2,
                             G_PARAM_READABLE);
  g_object_class_install_property (object_class, PROP_MAX_ZOOM, pspec);
}

static void
maps_file_data_source_init (MapsFileDataSource *data_source)
{
  data_source->priv = maps_file_data_source_get_instance_private (data_source);
  data_source->priv->path = NULL;
  data_source->priv->extension = NULL;
  data_source->priv->max_zoom = -1;
  data_source->priv->min_zoom = 21;
  data_source->priv->min_x = G_MAXLONG;
  data_source->priv->min_y = G_MAXLONG;
  data_source->priv->max_x = 0;
  data_source->priv->max_y = 0;

}

static gboolean
get_zoom_levels (MapsFileDataSource *data_source,
                 GError            **error)
{
  GFile *file;
  GFileEnumerator *enumerator;
  gboolean ret = TRUE;
  long orig_min = data_source->priv->min_zoom;
  long orig_max = data_source->priv->max_zoom;

  file = g_file_new_for_path (data_source->priv->path);
  enumerator = g_file_enumerate_children (file, "standard::*",
                                               G_FILE_QUERY_INFO_NOFOLLOW_SYMLINKS,
                                               NULL,
                                               error);
  if (!enumerator)
    return FALSE;

  while (TRUE)
    {
      GFileInfo *info;
      const char *name;
      char *endptr;
      long val;

      if (!g_file_enumerator_iterate (enumerator, &info, NULL, NULL, error)) {
        ret = FALSE;
        goto out;
      }

      if (!info)
        break;

      if (g_file_info_get_file_type (info) != G_FILE_TYPE_DIRECTORY)
        continue;

      name = g_file_info_get_name (info);
      val = strtol (name, &endptr, 0);
      if (endptr == name || *endptr != '\0')
        continue;

      if (val > data_source->priv->max_zoom)
        data_source->priv->max_zoom = val;

      if (val < data_source->priv->min_zoom)
        data_source->priv->min_zoom = val;
    }

    if (data_source->priv->min_zoom == orig_min ||
        data_source->priv->max_zoom == orig_max) {
      ret = FALSE;
      if (error)
        {
          *error = g_error_new_literal (MAPS_FILE_DATA_SOURCE_ERROR, 0,
                                        _("Failed to find tile structure in directory"));
        }
    }

 out:
  g_object_unref (file);
  g_object_unref (enumerator);

  return ret;
}

static gboolean
get_y_bounds (MapsFileDataSource *data_source,
              const char         *path,
              GError            **error)
{
  GFileEnumerator *enumerator;
  GFile *file;
  gboolean ret = TRUE;
  gboolean found = FALSE;

  file = g_file_new_for_path (path);
  enumerator = g_file_enumerate_children (file, "standard::*",
                                          G_FILE_QUERY_INFO_NOFOLLOW_SYMLINKS,
                                          NULL,
                                          error);
  if (!enumerator)
    return FALSE;

  while (TRUE)
    {
      GFileInfo *info;
      char **names;
      char *endptr;
      long y;

      if (!g_file_enumerator_iterate (enumerator, &info,
                                      NULL, NULL, error)) {
        ret = FALSE;
        goto out;
      }

      if (!info)
        break;

      if (g_file_info_get_file_type (info) != G_FILE_TYPE_REGULAR)
        continue;

      names = g_strsplit (g_file_info_get_name (info), ".", 2);
      if (!data_source->priv->extension)
          data_source->priv->extension = g_strdup (names[1]);

      y = strtol (names[0], &endptr, 0);
      if (endptr == names[0] || *endptr != '\0') {
        g_strfreev (names);
        continue;
      }

      if (!found)
        found = TRUE;

      g_strfreev (names);

      if (y > data_source->priv->max_y)
        data_source->priv->max_y = y;

      if (y < data_source->priv->min_y)
        data_source->priv->min_y = y;
    }

  if (!found)
    {
      ret = FALSE;
      if (error)
        {
          *error = g_error_new_literal (MAPS_FILE_DATA_SOURCE_ERROR, 0,
                                        _("Failed to find tile structure in directory"));
        }
    }

 out:
  g_object_unref (file);
  g_object_unref (enumerator);
  return ret;
}

static gboolean
get_bounds (MapsFileDataSource *data_source,
            GError            **error)
{
  GFileEnumerator *enumerator;
  GFile *file;
  char *path;
  gboolean ret = TRUE;
  char min_zoom[3];
  gboolean found = FALSE;

  sprintf (min_zoom, "%u", data_source->priv->min_zoom);
  path = g_build_filename (data_source->priv->path, min_zoom, NULL);
  file = g_file_new_for_path (path);

  enumerator = g_file_enumerate_children (file, "standard::*",
                                          G_FILE_QUERY_INFO_NOFOLLOW_SYMLINKS,
                                          NULL,
                                          error);
  if (!enumerator)
    return FALSE;

  while (TRUE)
    {
      char *y_path;
      GFileInfo *info;
      const char *name;
      char *endptr;
      long x;

      if (!g_file_enumerator_iterate (enumerator, &info, NULL, NULL, error)) {
        ret = FALSE;
        goto out;
      }

      if (!info)
        break;

      if (g_file_info_get_file_type (info) != G_FILE_TYPE_DIRECTORY)
        continue;

      name = g_file_info_get_name (info);
      x = strtol (name, &endptr, 0);
      if (endptr == name || *endptr != '\0')
        continue;

      if (!found)
        found = TRUE;

      if (x > data_source->priv->max_x)
        data_source->priv->max_x = x;

      if (x < data_source->priv->min_x)
        data_source->priv->min_x = x;

      y_path = g_build_filename (path, name, NULL);
      if (!get_y_bounds (data_source, y_path, error)) {
        g_free (y_path);
        ret = FALSE;
        goto out;
      }
      g_free (y_path);
    }

  if (!found)
    {
      ret = FALSE;
      if (error)
        {
          *error = g_error_new_literal (MAPS_FILE_DATA_SOURCE_ERROR, 0,
                                        _("Failed to find tile structure in directory"));
        }
    }

 out:
  g_free (path);
  g_object_unref (file);
  g_object_unref (enumerator);
  return ret;
}

gboolean
maps_file_data_source_prepare (MapsFileDataSource *data_source,
                               GError            **error)
{
  g_return_val_if_fail (MAPS_IS_FILE_DATA_SOURCE (data_source), FALSE);
  g_return_val_if_fail (data_source->priv->path != NULL, FALSE);

  if (!get_zoom_levels (data_source, error)) {
    return FALSE;
  }

  if (!get_bounds (data_source, error)) {
    return FALSE;
  }

  return TRUE;
}

typedef struct {
  MapsFileDataSource *self;
  int x;
  int y;
  int z;
  GBytes *bytes;
  GFile *file;
} FillTileData;

static void
fill_tile_data_free (FillTileData *data)
{
  g_clear_object (&data->self);
  g_clear_pointer (&data->file, g_object_unref);
  g_free (data);
}

static void
on_file_load (GObject      *source_object,
              GAsyncResult *res,
              gpointer      user_data)
{
  g_autoptr(GTask) task = user_data;
  g_autoptr(GError) error = NULL;
  FillTileData *data = g_task_get_task_data (task);
  char *contents;
  gsize length;

  g_file_load_contents_finish (data->file, res, &contents, &length, NULL, &error);

  if (error)
    {
      g_warning ("Failed to load file: %s", error->message);
      return;
    }

  if (contents != NULL)
    {
      data->bytes = g_bytes_new_take (contents, length);
      g_signal_emit_by_name (data->self, "received-data", data->x, data->y, data->z, data->bytes);
      g_task_return_pointer (task, g_steal_pointer (&data->bytes), (GDestroyNotify)g_bytes_unref);
    }
}

static void
get_tile_data_async (ShumateDataSource     *source,
                     int                   x,
                     int                   y,
                     int                   zoom_level,
                     GCancellable         *cancellable,
                     GAsyncReadyCallback   callback,
                     gpointer              user_data)
{
  g_return_if_fail (MAPS_IS_FILE_DATA_SOURCE (source));

  MapsFileDataSource *data_source = MAPS_FILE_DATA_SOURCE (source);
  GFile *file;
  gchar *path = NULL;
  g_autoptr(GTask) task = NULL;
  FillTileData *data;

  path = g_strdup_printf("%s/%d/%d/%d.%s",
                         data_source->priv->path,
                         zoom_level,
                         x,
                         y,
                         data_source->priv->extension);
  file = g_file_new_for_path (path);

  task = g_task_new (source, cancellable, callback, user_data);
  g_task_set_source_tag (task, get_tile_data_async);

  data = g_new0 (FillTileData, 1);
  data->self = g_object_ref (data_source);
  data->x = x;
  data->y = y;
  data->z = zoom_level;
  data->file = g_object_ref (file);
  g_task_set_task_data (task, data, (GDestroyNotify) fill_tile_data_free);

  if (g_file_query_exists(file, NULL))
    {
      g_file_load_contents_async (file, cancellable,
                                  on_file_load,
                                  g_object_ref (task));
    }

  g_object_unref (file);
  g_free (path);
}

