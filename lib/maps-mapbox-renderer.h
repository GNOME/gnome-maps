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

#ifndef __MAPS_MAPBOX_RENDERER_H__
#define __MAPS_MAPBOX_RENDERER_H__

#include <champlain/champlain.h>
#include <vector-tile-mapbox.h>

G_BEGIN_DECLS

#define MAPS_TYPE_MAPBOX_RENDERER maps_mapbox_renderer_get_type ()

#define MAPS_MAPBOX_RENDERER(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), MAPS_TYPE_MAPBOX_RENDERER, MapsMapboxRenderer))

#define MAPS_MAPBOX_RENDERER_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), MAPS_TYPE_MAPBOX_RENDERER, MapsMapboxRendererClass))

#define MAPS_IS_MAPBOX_RENDERER(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), MAPS_TYPE_MAPBOX_RENDERER))

#define MAPS_IS_MAPBOX_RENDERER_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), MAPS_TYPE_MAPBOX_RENDERER))

#define MAPS_MAPBOX_RENDERER_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), MAPS_TYPE_MAPBOX_RENDERER, MapsMapboxRendererClass))

typedef struct _MapsMapboxRendererPrivate MapsMapboxRendererPrivate;
typedef struct _MapsMapboxRenderer MapsMapboxRenderer;
typedef struct _MapsMapboxRendererClass MapsMapboxRendererClass;

/**
 * MapsMapboxRenderer:
 *
 * The #MapsMapboxRenderer structure contains only private data
 * and should be accessed using the provided API
 */
struct _MapsMapboxRenderer
{
  ChamplainRenderer parent;

  MapsMapboxRendererPrivate *priv;
};

struct _MapsMapboxRendererClass
{
  ChamplainRendererClass parent_class;
};

GType maps_mapbox_renderer_get_type (void);

MapsMapboxRenderer *maps_mapbox_renderer_new (void);
MapsMapboxRenderer *maps_mapbox_renderer_new_with_view (ChamplainView *view);


void maps_mapbox_renderer_load_css (MapsMapboxRenderer *renderer,
                                    const char *filename,
                                    const char *search_path,
                                    GError **error);

void maps_mapbox_renderer_set_view (MapsMapboxRenderer *renderer,
                                    ChamplainView *view);

G_END_DECLS

#endif /* __MAPS_MAPBOX_RENDERER_H__ */
