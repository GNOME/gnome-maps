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

#ifndef _MAPS_SYNC_MAP_SOURCE_H_
#define _MAPS_SYNC_MAP_SOURCE_H_

#include <shumate/shumate.h>

G_BEGIN_DECLS

#define MAPS_TYPE_SYNC_MAP_SOURCE maps_sync_map_source_get_type ()

#define MAPS_SYNC_MAP_SOURCE(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), MAPS_TYPE_SYNC_MAP_SOURCE, MapsSyncMapSource))

#define MAPS_SYNC_MAP_SOURCE_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), MAPS_TYPE_SYNC_MAP_SOURCE, MapsSyncMapSourceClass))

#define MAPS_IS_SYNC_MAP_SOURCE(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), MAPS_TYPE_SYNC_MAP_SOURCE))

#define MAPS_IS_SYNC_MAP_SOURCE_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), MAPS_TYPE_SYNC_MAP_SOURCE))

#define MAPS_SYNC_MAP_SOURCE_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), MAPS_TYPE_SYNC_MAP_SOURCE, MapsSyncMapSourceClass))

typedef struct _MapsSyncMapSourcePrivate MapsSyncMapSourcePrivate;

typedef struct _MapsSyncMapSource MapsSyncMapSource;
typedef struct _MapsSyncMapSourceClass MapsSyncMapSourceClass;

/**
 * MapsSyncMapSource:
 *
 * Wrapper of ShumateMapSource encapsulating fill_tile_async and
 * fill_tile_finish into a synchronous file_tile vfunc as work-around for
 * https://gitlab.gnome.org/GNOME/gjs/-/issues/72
 *
 * The #MapsSyncMapSource structure contains only private data
 * and should be accessed using the provided API
 *
 */
struct _MapsSyncMapSource
{
  ShumateMapSource parent_instance;

  MapsSyncMapSourcePrivate *priv;
};

struct _MapsSyncMapSourceClass
{
  ShumateMapSourceClass parent_class;

  void (*fill_tile)  (MapsSyncMapSource     *self,
                      ShumateTile           *tile);
};

GType maps_sync_map_source_get_type (void);

#endif /* _MAPS_SYNC_MAP_SOURCE_H_ */
