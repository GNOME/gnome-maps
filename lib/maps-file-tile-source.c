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

#include <champlain/champlain.h>
#include <gio/gio.h>
#include <glib.h>
#include <glib-object.h>
#include <libsoup/soup.h>
#include <stdlib.h>

#include "mapsintl.h"
#include "maps-file-tile-source.h"

#define MAPS_FILE_TILE_SOURCE_ERROR maps_file_tile_source_error_quark ()

GQuark
maps_file_tile_source_error_quark (void)
{
  return g_quark_from_static_string ("maps-file-tile-source-error");
}

enum {
  PROP_0,

  PROP_PATH,
  PROP_MAX_ZOOM,
  PROP_MIN_ZOOM,
  PROP_WORLD

};

struct _MapsFileTileSourcePrivate
{
  gchar *path;
  gchar *extension;
  gint max_zoom;
  gint min_zoom;
  ChamplainBoundingBox *world;

  long min_x;
  long min_y;
  long max_x;
  long max_y;
};

typedef struct
{
  ChamplainMapSource *map_source;
  ChamplainTile *tile;
} CallbackData;

G_DEFINE_TYPE_WITH_PRIVATE (MapsFileTileSource, maps_file_tile_source, CHAMPLAIN_TYPE_TILE_SOURCE)

static void fill_tile (ChamplainMapSource *map_source,
    ChamplainTile *tile);


static void
maps_file_tile_source_set_property (GObject      *object,
                                    guint         prop_id,
                                    const GValue *value,
                                    GParamSpec   *pspec)
{
  MapsFileTileSource *tile_source = MAPS_FILE_TILE_SOURCE (object);

  switch (prop_id)
    {
    case PROP_PATH:
      tile_source->priv->path = g_strdup ((char *) g_value_get_string (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_file_tile_source_get_property (GObject *object,
    guint prop_id,
    GValue *value,
    GParamSpec *pspec)
{
  MapsFileTileSource *tile_source = MAPS_FILE_TILE_SOURCE (object);

  switch (prop_id)
    {
    case PROP_PATH:
      g_value_set_string (value, tile_source->priv->path);
      break;

    case PROP_MIN_ZOOM:
      g_value_set_uint (value, tile_source->priv->min_zoom);
      break;

    case PROP_MAX_ZOOM:
      g_value_set_uint (value, tile_source->priv->max_zoom);
      break;

    case PROP_WORLD:
      g_value_set_boxed (value, tile_source->priv->world);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_file_tile_source_dispose (GObject *object)
{
  G_OBJECT_CLASS (maps_file_tile_source_parent_class)->dispose (object);
}

static void
maps_file_tile_source_finalize (GObject *object)
{
  MapsFileTileSource *tile_source = MAPS_FILE_TILE_SOURCE (object);

  if (tile_source->priv->path)
    g_free (tile_source->priv->path);

  if (tile_source->priv->extension)
    g_free (tile_source->priv->extension);

  G_OBJECT_CLASS (maps_file_tile_source_parent_class)->finalize (object);
}

static guint
get_max_zoom_level (ChamplainMapSource *source)
{
  MapsFileTileSource *tile_source = (MapsFileTileSource *) source;

  return tile_source->priv->max_zoom;
}

static guint
get_min_zoom_level (ChamplainMapSource *source)
{
  MapsFileTileSource *tile_source = (MapsFileTileSource *) source;

  return tile_source->priv->min_zoom;
}

static void
maps_file_tile_source_class_init (MapsFileTileSourceClass *klass)
{
  ChamplainMapSourceClass *map_source_class = CHAMPLAIN_MAP_SOURCE_CLASS (klass);
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  GParamSpec *pspec;

  object_class->finalize = maps_file_tile_source_finalize;
  object_class->dispose = maps_file_tile_source_dispose;
  object_class->get_property = maps_file_tile_source_get_property;
  object_class->set_property = maps_file_tile_source_set_property;
  map_source_class->get_max_zoom_level = get_max_zoom_level;
  map_source_class->get_min_zoom_level = get_min_zoom_level;
  map_source_class->fill_tile = fill_tile;

  /**
   * MapsFileTileSource:path:
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
   * MapsFileTileSource:min-zoom:
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
   * MapsFileTileSource:max-zoom:
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

  /**
   * MapsFileTileSource:world:
   *
   * Set a bounding box to limit the world to. No tiles will be loaded
   * outside of this bounding box. It will not be possible to scroll outside
   * of this bounding box.
   *
   */
  pspec = g_param_spec_boxed ("world",
                              "The world",
                              "The bounding box to limit the #ChamplainView to",
                              CHAMPLAIN_TYPE_BOUNDING_BOX,
                              G_PARAM_READABLE);
  g_object_class_install_property (object_class, PROP_WORLD, pspec);
}

static void
maps_file_tile_source_init (MapsFileTileSource *tile_source)
{
  tile_source->priv = maps_file_tile_source_get_instance_private (tile_source);
  tile_source->priv->path = NULL;
  tile_source->priv->extension = NULL;
  tile_source->priv->max_zoom = -1;
  tile_source->priv->min_zoom = 21;
  tile_source->priv->world = NULL;
  tile_source->priv->min_x = G_MAXLONG;
  tile_source->priv->min_y = G_MAXLONG;
  tile_source->priv->max_x = 0;
  tile_source->priv->max_y = 0;
}

static gboolean
get_zoom_levels (MapsFileTileSource *tile_source,
                 GError            **error)
{
  GFile *file;
  GFileEnumerator *enumerator;
  gboolean ret = TRUE;
  long orig_min = tile_source->priv->min_zoom;
  long orig_max = tile_source->priv->max_zoom;

  file = g_file_new_for_path (tile_source->priv->path);
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

      if (val > tile_source->priv->max_zoom)
        tile_source->priv->max_zoom = val;

      if (val < tile_source->priv->min_zoom)
        tile_source->priv->min_zoom = val;
    }

    if (tile_source->priv->min_zoom == orig_min ||
        tile_source->priv->max_zoom == orig_max) {
      ret = FALSE;
      if (error)
        {
          *error = g_error_new_literal (MAPS_FILE_TILE_SOURCE_ERROR, 0,
                                        _("Failed to find tile structure in directory"));
        }
    }

 out:
  g_object_unref (file);
  g_object_unref (enumerator);

  return ret;
}

static gboolean
get_y_bounds (MapsFileTileSource *tile_source,
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
      if (!tile_source->priv->extension)
          tile_source->priv->extension = g_strdup (names[1]);

      y = strtol (names[0], &endptr, 0);
      if (endptr == names[0] || *endptr != '\0') {
        g_strfreev (names);
        continue;
      }

      if (!found)
        found = TRUE;

      g_strfreev (names);

      if (y > tile_source->priv->max_y)
        tile_source->priv->max_y = y;

      if (y < tile_source->priv->min_y)
        tile_source->priv->min_y = y;
    }

  if (!found)
    {
      ret = FALSE;
      if (error)
        {
          *error = g_error_new_literal (MAPS_FILE_TILE_SOURCE_ERROR, 0,
                                        _("Failed to find tile structure in directory"));
        }
    }

 out:
  g_object_unref (file);
  g_object_unref (enumerator);
  return ret;
}

static gboolean
get_bounds (MapsFileTileSource *tile_source,
            GError            **error)
{
  GFileEnumerator *enumerator;
  GFile *file;
  char *path;
  gboolean ret = TRUE;
  char min_zoom[3];
  gboolean found = FALSE;

  sprintf (min_zoom, "%u", tile_source->priv->min_zoom);
  path = g_build_filename (tile_source->priv->path, min_zoom, NULL);
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

      if (x > tile_source->priv->max_x)
        tile_source->priv->max_x = x;

      if (x < tile_source->priv->min_x)
        tile_source->priv->min_x = x;

      y_path = g_build_filename (path, name, NULL);
      if (!get_y_bounds (tile_source, y_path, error)) {
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
          *error = g_error_new_literal (MAPS_FILE_TILE_SOURCE_ERROR, 0,
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
maps_file_tile_source_prepare (MapsFileTileSource *tile_source,
                               GError            **error)
{
  g_return_if_fail (MAPS_IS_FILE_TILE_SOURCE (tile_source));
  g_return_if_fail (tile_source->priv->path != NULL);

  ChamplainMapSource *source = (ChamplainMapSource *) tile_source;
  gboolean ret = TRUE;

  if (!get_zoom_levels (tile_source, error)) {
    ret = FALSE;
    goto out;
  }

  if (!get_bounds (tile_source, error)) {
    ret = FALSE;
    goto out;
  }

  tile_source->priv->world = champlain_bounding_box_new ();
  tile_source->priv->world->left = champlain_map_source_get_longitude (source,
                                                    tile_source->priv->min_zoom,
                                                    tile_source->priv->min_x * 256);
  tile_source->priv->world->right = champlain_map_source_get_longitude (source,
                                                     tile_source->priv->min_zoom,
                                                     tile_source->priv->max_x * 256);
  tile_source->priv->world->top = champlain_map_source_get_latitude (source,
                                                     tile_source->priv->min_zoom,
                                                     tile_source->priv->min_y * 256);
  tile_source->priv->world->bottom = champlain_map_source_get_latitude (source,
                                                  tile_source->priv->min_zoom,
                                                  tile_source->priv->max_y * 256);
 out:
  return ret;
}

static void
tile_rendered_cb (ChamplainTile    *tile,
                  gpointer          data,
                  guint             size,
                  gboolean          error,
                  CallbackData     *user_data)
{
  ChamplainMapSource *map_source = user_data->map_source;
  ChamplainMapSource *next_source;

  g_signal_handlers_disconnect_by_func (tile, tile_rendered_cb, user_data);
  g_slice_free (CallbackData, user_data);

  next_source = champlain_map_source_get_next_source (map_source);

  if (!error)
    {
      ChamplainTileSource *tile_source = CHAMPLAIN_TILE_SOURCE (map_source);
      ChamplainTileCache *tile_cache = champlain_tile_source_get_cache (tile_source);

      if (tile_cache && data)
        champlain_tile_cache_store_tile (tile_cache, tile, data, size);

      champlain_tile_set_fade_in (tile, TRUE);
      champlain_tile_set_state (tile, CHAMPLAIN_STATE_DONE);
      champlain_tile_display_content (tile);
    }
  else if (next_source)
    champlain_map_source_fill_tile (next_source, tile);

  g_object_unref (map_source);
  g_object_unref (tile);
}

static void
tile_loaded_cb (GFile        *file,
                GAsyncResult *res,
                CallbackData *user_data)
{
  ChamplainMapSource *map_source = user_data->map_source;
  ChamplainTileSource *tile_source = CHAMPLAIN_TILE_SOURCE (map_source);
  ChamplainMapSource *next_source = champlain_map_source_get_next_source (map_source);
  ChamplainTile *tile = user_data->tile;
  CallbackData *data;
  ChamplainRenderer *renderer;
  char *content;
  gsize length;

  g_slice_free (CallbackData, user_data);

  if (!g_file_load_contents_finish (file, res, &content, &length, NULL, NULL))
    {
      goto load_next;
    }

  renderer = champlain_map_source_get_renderer (map_source);
  g_return_if_fail (CHAMPLAIN_IS_RENDERER (renderer));

  data = g_slice_new (CallbackData);
  data->map_source = map_source;

  g_signal_connect (tile, "render-complete", G_CALLBACK (tile_rendered_cb), data);

  champlain_renderer_set_data (renderer, content, length);
  champlain_renderer_render (renderer, tile);

  return;

load_next:
  if (next_source)
    champlain_map_source_fill_tile (next_source, tile);

  goto cleanup;

finish:
  champlain_tile_set_fade_in (tile, TRUE);
  champlain_tile_set_state (tile, CHAMPLAIN_STATE_DONE);
  champlain_tile_display_content (tile);

cleanup:
  g_object_unref (tile);
  g_object_unref (map_source);
}

static void
fill_tile (ChamplainMapSource *map_source,
           ChamplainTile      *tile)
{
  g_return_if_fail (MAPS_IS_FILE_TILE_SOURCE (map_source));
  g_return_if_fail (CHAMPLAIN_IS_TILE (tile));

  MapsFileTileSource *tile_source = MAPS_FILE_TILE_SOURCE (map_source);
  CallbackData *callback_data;
  GFile *file;
  gchar *path = NULL;

  if (champlain_tile_get_state (tile) == CHAMPLAIN_STATE_DONE)
    return;

  path = g_strdup_printf("%s/%d/%d/%d.%s",
                         tile_source->priv->path,
                         champlain_tile_get_zoom_level (tile),
                         champlain_tile_get_x (tile),
                         champlain_tile_get_y (tile),
                         tile_source->priv->extension);
  file = g_file_new_for_path (path);

  if (g_file_query_exists(file, NULL))
    {
      callback_data = g_slice_new (CallbackData);
      callback_data->tile = tile;
      callback_data->map_source = map_source;

      g_object_ref (map_source);
      g_object_ref (tile);

      g_file_load_contents_async (file, NULL,
                                  (GAsyncReadyCallback) tile_loaded_cb,
                                  callback_data);
    }
  else
    {
      ChamplainMapSource *next_source = champlain_map_source_get_next_source (map_source);

      if (CHAMPLAIN_IS_MAP_SOURCE (next_source))
        champlain_map_source_fill_tile (next_source, tile);
    }

  g_object_unref (file);
  g_free (path);
}
