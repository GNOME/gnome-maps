#include "maps-mapbox-text-layer.h"

#include <clutter/clutter.h>
#include <glib.h>

struct _MapsMapboxTextLayerPrivate
{
  ChamplainView *view;
  GHashTable *objects;
};

G_DEFINE_TYPE_WITH_PRIVATE (MapsMapboxTextLayer, maps_mapbox_text_layer, CHAMPLAIN_TYPE_LAYER)

static void set_view (ChamplainLayer *layer,
                      ChamplainView *view);

static ChamplainBoundingBox *get_bounding_box (ChamplainLayer *layer);

static void
maps_mapbox_text_layer_dispose (GObject *object)
{
  MapsMapboxTextLayer *self = MAPS_MAPBOX_TEXT_LAYER (object);
  MapsMapboxTextLayerPrivate *priv = self->priv;

  if (priv->view != NULL)
    set_view (CHAMPLAIN_LAYER (self), NULL);

  G_OBJECT_CLASS (maps_mapbox_text_layer_parent_class)->dispose (object);
}


static void
maps_mapbox_text_layer_finalize (GObject *object)
{
  G_OBJECT_CLASS (maps_mapbox_text_layer_parent_class)->finalize (object);
}


static void
maps_mapbox_text_layer_class_init (MapsMapboxTextLayerClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  ChamplainLayerClass *layer_class = CHAMPLAIN_LAYER_CLASS (klass);

  object_class->finalize = maps_mapbox_text_layer_finalize;
  object_class->dispose = maps_mapbox_text_layer_dispose;

  layer_class->set_view = set_view;
  layer_class->get_bounding_box = get_bounding_box;
}


static void
maps_mapbox_text_layer_init (MapsMapboxTextLayer *self)
{
  MapsMapboxTextLayerPrivate *priv;

  self->priv = maps_mapbox_text_layer_get_instance_private (self);
  self->priv->objects = g_hash_table_new_full (g_str_hash, g_str_equal,
                                               g_free, NULL);
  self->priv->view = NULL;
}


/**
 * maps_mapbox_text_layer_new:
 *
 * Creates a new instance of #MapsMapboxTextLayer.
 *
 * Returns: a new #MapsMapboxTextLayer ready to be used as a container for text.
 *
 */
MapsMapboxTextLayer *
maps_mapbox_text_layer_new ()
{
  return g_object_new (MAPS_TYPE_MAPBOX_TEXT_LAYER, NULL);
}

gboolean
on_text_draw (ClutterCanvas *canvas,
              cairo_t *cr,
              gint width,
              gint height,
              VTileMapboxText *text)
{
  cairo_surface_t *surface;

  cairo_set_operator (cr, CAIRO_OPERATOR_CLEAR);
  cairo_paint (cr);
  cairo_set_operator (cr, CAIRO_OPERATOR_OVER);

  cairo_set_source_surface (cr, text->surface,
                            -text->surface_offset_x,
                            -text->surface_offset_y);
  cairo_paint (cr);
  surface = cairo_get_target (cr);
  g_signal_handlers_disconnect_by_func (canvas, on_text_draw, text);

  return TRUE;
}

static gboolean
text_collide (MapsMapboxTextLayer *layer,
              gfloat tile_x,
              gfloat tile_y,
              VTileMapboxText *text)
{
  ClutterActorIter iter;
  ClutterActor *child;
  gfloat text_x, text_y;

  text_x = tile_x + text->offset_x;
  text_y = tile_y + text->offset_y;

  clutter_actor_iter_init (&iter, CLUTTER_ACTOR (layer));
  while (clutter_actor_iter_next (&iter, &child)) {
    gfloat child_x, child_y;
    gfloat child_width, child_height;

    clutter_actor_get_position (child, &child_x, &child_y);
    clutter_actor_get_size (child, &child_width, &child_height);

    if ((text_x < child_x + child_width) &&
        (text_x + text->width > child_x) &&
        (text_y < child_y + child_height) &&
        (text_y + text->height > child_y))
      return TRUE;
  }

  return FALSE;
}

void
maps_mapbox_text_layer_add_text (MapsMapboxTextLayer *layer,
                                 ChamplainTile *tile,
                                 VTileMapboxText *text)
{
  g_return_if_fail (MAPS_IS_MAPBOX_TEXT_LAYER (layer));

  ClutterContent *canvas;
  ClutterActor *actor;
  gfloat tile_x, tile_y;

  if (g_hash_table_lookup (layer->priv->objects, text->uid))
    return;

  clutter_actor_get_position ((ClutterActor *) tile, &tile_x, &tile_y);
  if (text_collide (layer, tile_x, tile_y, text))
    return;

  g_hash_table_insert (layer->priv->objects,
                       g_strdup (text->uid), "dummy");

  canvas = clutter_canvas_new ();
  clutter_canvas_set_size (CLUTTER_CANVAS (canvas), text->width, text->height);
  g_signal_connect (canvas, "draw", G_CALLBACK (on_text_draw), text);
  clutter_content_invalidate (canvas);

  actor = clutter_actor_new ();
  clutter_actor_set_size (actor, text->width, text->height);
  clutter_actor_set_content (actor, canvas);
  g_object_unref (canvas);

  clutter_actor_set_position (actor,
                              tile_x + text->offset_x,
                              tile_y + text->offset_y);

  clutter_actor_add_child (CLUTTER_ACTOR (layer), actor);
}

/**
 * maps_mapbox_text_layer_remove_all:
 * @layer: a #MapsMapboxTextLayer
 *
 * Removes all texts from the layer.
 *
 * Since: 0.10
 */
void
maps_mapbox_text_layer_remove_all (MapsMapboxTextLayer *layer)
{
  g_return_if_fail (MAPS_IS_MAPBOX_TEXT_LAYER (layer));

  clutter_actor_remove_all_children (CLUTTER_ACTOR (layer));
  g_hash_table_remove_all (layer->priv->objects);
}

static void
relocate_cb (G_GNUC_UNUSED GObject *gobject,
             MapsMapboxTextLayer *layer)
{
  g_return_if_fail (MAPS_IS_MAPBOX_TEXT_LAYER (layer));

  maps_mapbox_text_layer_remove_all (layer);
}


static void
zoom_reposition_cb (G_GNUC_UNUSED GObject *gobject,
                    G_GNUC_UNUSED GParamSpec *arg1,
                    MapsMapboxTextLayer *layer)
{
  g_return_if_fail (MAPS_IS_MAPBOX_TEXT_LAYER (layer));

  maps_mapbox_text_layer_remove_all (layer);
}

static void
set_view (ChamplainLayer *layer,
          ChamplainView *view)
{
  g_return_if_fail (MAPS_IS_MAPBOX_TEXT_LAYER (layer) &&
                    (CHAMPLAIN_IS_VIEW (view) || view == NULL));

  MapsMapboxTextLayer *text_layer = MAPS_MAPBOX_TEXT_LAYER (layer);

  if (text_layer->priv->view != NULL)
    {
      g_signal_handlers_disconnect_by_func (text_layer->priv->view,
          G_CALLBACK (relocate_cb), text_layer);
      g_object_unref (text_layer->priv->view);
    }

  text_layer->priv->view = view;

  if (view != NULL)
    {
      g_object_ref (view);

      g_signal_connect (view, "layer-relocated",
          G_CALLBACK (relocate_cb), layer);

      g_signal_connect (view, "notify::zoom-level",
          G_CALLBACK (zoom_reposition_cb), layer);

      maps_mapbox_text_layer_remove_all (text_layer);
    }
}

static ChamplainBoundingBox *
get_bounding_box (ChamplainLayer *layer)
{
  ChamplainBoundingBox *bbox;

  g_return_val_if_fail (MAPS_IS_MAPBOX_TEXT_LAYER (layer), NULL);

  return champlain_bounding_box_new ();
}
