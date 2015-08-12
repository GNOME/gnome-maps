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

#ifndef _MAPS_FILE_TILE_SOURCE_H_
#define _MAPS_FILE_TILE_SOURCE_H_

#include <champlain/champlain.h>

G_BEGIN_DECLS

#define MAPS_TYPE_FILE_TILE_SOURCE maps_file_tile_source_get_type ()

#define MAPS_FILE_TILE_SOURCE(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), MAPS_TYPE_FILE_TILE_SOURCE, MapsFileTileSource))

#define MAPS_FILE_TILE_SOURCE_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), MAPS_TYPE_FILE_TILE_SOURCE, MapsFileTileSourceClass))

#define MAPS_IS_FILE_TILE_SOURCE(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), MAPS_TYPE_FILE_TILE_SOURCE))

#define MAPS_IS_FILE_TILE_SOURCE_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), MAPS_TYPE_FILE_TILE_SOURCE))

#define MAPS_FILE_TILE_SOURCE_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), MAPS_TYPE_FILE_TILE_SOURCE, MapsFileTileSourceClass))

typedef struct _MapsFileTileSourcePrivate MapsFileTileSourcePrivate;

typedef struct _MapsFileTileSource MapsFileTileSource;
typedef struct _MapsFileTileSourceClass MapsFileTileSourceClass;

/**
 * MapsFileTileSource:
 *
 * The #MapsFileTileSource structure contains only private data
 * and should be accessed using the provided API
 *
 */
struct _MapsFileTileSource
{
  ChamplainTileSource parent_instance;

  MapsFileTileSourcePrivate *priv;
};

struct _MapsFileTileSourceClass
{
  ChamplainTileSourceClass parent_class;
};

GType maps_file_tile_source_get_type (void);

gboolean maps_file_tile_source_prepare (MapsFileTileSource *tile_source, GError **error);
G_END_DECLS

#endif /* _MAPS_FILE_TILE_SOURCE_H_ */
