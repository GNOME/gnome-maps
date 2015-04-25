#ifndef MAPS_MAPBOX_TEXT_LAYER_H
#define MAPS_MAPBOX_TEXT_LAYER_H

#include <champlain/champlain.h>
#include <vector-tile-mapbox.h>

#include <glib-object.h>
#include <clutter/clutter.h>

G_BEGIN_DECLS

#define MAPS_TYPE_MAPBOX_TEXT_LAYER maps_mapbox_text_layer_get_type ()

#define MAPS_MAPBOX_TEXT_LAYER(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), MAPS_TYPE_MAPBOX_TEXT_LAYER, MapsMapboxTextLayer))

#define MAPS_MAPBOX_TEXT_LAYER_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), MAPS_TYPE_MAPBOX_TEXT_LAYER, MapsMapboxTextLayerClass))

#define MAPS_IS_MAPBOX_TEXT_LAYER(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), MAPS_TYPE_MAPBOX_TEXT_LAYER))

#define MAPS_IS_MAPBOX_TEXT_LAYER_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), MAPS_TYPE_MAPBOX_TEXT_LAYER))

#define MAPS_MAPBOX_TEXT_LAYER_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), MAPS_TYPE_MAPBOX_TEXT_LAYER, MapsMapboxTextLayerClass))

typedef struct _MapsMapboxTextLayerPrivate MapsMapboxTextLayerPrivate;
typedef struct _MapsMapboxTextLayer MapsMapboxTextLayer;
typedef struct _MapsMapboxTextLayerClass MapsMapboxTextLayerClass;

struct _MapsMapboxTextLayer
{
  ChamplainLayer parent;

  MapsMapboxTextLayerPrivate *priv;
};

struct _MapsMapboxTextLayerClass
{
  ChamplainLayerClass parent_class;
};

GType maps_mapbox_text_layer_get_type (void);

MapsMapboxTextLayer *maps_mapbox_text_layer_new (void);
void maps_mapbox_text_layer_add_text (MapsMapboxTextLayer *layer,
                                      ChamplainTile *tile,
                                      VTileMapboxText *mapbox_text);
void maps_mapbox_text_layer_remove_all (MapsMapboxTextLayer *layer);


G_END_DECLS

#endif
