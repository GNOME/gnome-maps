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

#ifndef _MAPS_FILE_DATA_SOURCE_H_
#define _MAPS_FILE_DATA_SOURCE_H_

#include <shumate/shumate.h>

G_BEGIN_DECLS

#define MAPS_TYPE_FILE_DATA_SOURCE maps_file_data_source_get_type ()

#define MAPS_FILE_DATA_SOURCE(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), MAPS_TYPE_FILE_DATA_SOURCE, MapsFileDataSource))

#define MAPS_FILE_DATA_SOURCE_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), MAPS_TYPE_FILE_DATA_SOURCE, MapsFileDataSourceClass))

#define MAPS_IS_FILE_DATA_SOURCE(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), MAPS_TYPE_FILE_DATA_SOURCE))

#define MAPS_IS_FILE_DATA_SOURCE_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), MAPS_TYPE_FILE_DATA_SOURCE))

#define MAPS_FILE_DATA_SOURCE_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), MAPS_TYPE_FILE_TILE_SOURCE, MapsFileDataSourceClass))

typedef struct _MapsFileDataSourcePrivate MapsFileDataSourcePrivate;

typedef struct _MapsFileDataSource MapsFileDataSource;
typedef struct _MapsFileDataSourceClass MapsFileDataSourceClass;

/**
 * MapsFileDataSource:
 *
 * The #MapsFileDataSource structure contains only private data
 * and should be accessed using the provided API
 *
 */
struct _MapsFileDataSource
{
  ShumateDataSource parent_instance;

  MapsFileDataSourcePrivate *priv;
};

struct _MapsFileDataSourceClass
{
  ShumateDataSourceClass parent_class;
};

GType maps_file_data_source_get_type (void);

gboolean maps_file_data_source_prepare (MapsFileDataSource *data_source, GError **error);
G_END_DECLS

#endif /* _MAPS_FILE_DATA_SOURCE_H_ */
