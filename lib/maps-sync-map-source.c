/*
 * Copyright (c) 2022 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

#include <shumate/shumate.h>
#include <glib.h>
#include <glib-object.h>
#include <stdlib.h>

#include "maps-sync-map-source.h"

G_DEFINE_ABSTRACT_TYPE (MapsSyncMapSource, maps_sync_map_source, SHUMATE_TYPE_MAP_SOURCE)

static void
fill_tile_async (ShumateMapSource     *source,
                 ShumateTile          *tile,
                 GCancellable         *cancellable,
                 GAsyncReadyCallback   callback,
                 gpointer              user_data);

static gboolean
fill_tile_finish (ShumateMapSource *map_source,
                  GAsyncResult *result,
                  GError **error);

static void
maps_sync_map_source_class_init (MapsSyncMapSourceClass *klass)
{
  ShumateMapSourceClass *map_source_class = SHUMATE_MAP_SOURCE_CLASS (klass);

  map_source_class->fill_tile_async = fill_tile_async;
  map_source_class->fill_tile_finish = fill_tile_finish;

  klass->fill_tile = NULL;
}

static void
maps_sync_map_source_init (MapsSyncMapSource *map_source)
{
  map_source->priv = maps_sync_map_source_get_instance_private (map_source);
}

static void
fill_tile_async (ShumateMapSource     *source,
                 ShumateTile          *tile,
                 GCancellable         *cancellable,
                 GAsyncReadyCallback   callback,
                 gpointer              user_data)
{
  g_return_if_fail (MAPS_IS_SYNC_MAP_SOURCE (source));
  MapsSyncMapSource *self = MAPS_SYNC_MAP_SOURCE(source);

  g_autoptr(GTask) task = NULL;

 // TODO: this gives a null gobject cast runtime error...
  MAPS_SYNC_MAP_SOURCE_GET_CLASS (self)->fill_tile (self, tile);

  task = g_task_new (source, cancellable, callback, user_data);
  g_task_set_source_tag (task, fill_tile_async);


  g_task_return_boolean (task, TRUE);
}

static gboolean
fill_tile_finish (ShumateMapSource *map_source,
                                        GAsyncResult *result,
                                        GError **error)
{
  MapsSyncMapSource *self = (MapsSyncMapSource *) map_source;

  g_return_val_if_fail (MAPS_IS_SYNC_MAP_SOURCE (self), FALSE);
  g_return_val_if_fail (g_task_is_valid (result, self), FALSE);

  return g_task_propagate_boolean (G_TASK (result), error);
}
