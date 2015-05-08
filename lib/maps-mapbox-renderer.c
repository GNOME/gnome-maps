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

#include <vector-tile-mapbox.h>
#include <cairo.h>

#include "maps-mapbox-renderer.h"
#include "maps-mapbox-text-layer.h"

enum
{
  PARSE_ERROR,
  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0, };

struct _MapsMapboxRendererPrivate
{
  gchar *data;
  guint size;
  MapsMapboxTextLayer *layer;
  ChamplainView *view;

  VTileMapCSS *stylesheet;
};

typedef struct _RenderData
{
  ChamplainTile *tile;
  MapsMapboxTextLayer *layer;
  ChamplainView *view;
  ClutterContent *canvas;
  gchar *data;
  guint size;
  VTileMapCSS *stylesheet;
} RenderData;

G_DEFINE_TYPE_WITH_PRIVATE (MapsMapboxRenderer, maps_mapbox_renderer, CHAMPLAIN_TYPE_RENDERER)

static void set_data (ChamplainRenderer *renderer,
                      const gchar *data,
                      guint size);
static void render (ChamplainRenderer *renderer,
                    ChamplainTile *tile);

static void
maps_mapbox_renderer_dispose (GObject *object)
{
  G_OBJECT_CLASS (maps_mapbox_renderer_parent_class)->dispose (object);
}


static void
maps_mapbox_renderer_finalize (GObject *object)
{
  MapsMapboxRenderer *renderer = MAPS_MAPBOX_RENDERER (object);
  g_free (renderer->priv->data);

  G_OBJECT_CLASS (maps_mapbox_renderer_parent_class)->finalize (object);
}


static void
maps_mapbox_renderer_class_init (MapsMapboxRendererClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  ChamplainRendererClass *renderer_class = CHAMPLAIN_RENDERER_CLASS (klass);

  object_class->finalize = maps_mapbox_renderer_finalize;
  object_class->dispose = maps_mapbox_renderer_dispose;

  renderer_class->set_data = set_data;
  renderer_class->render = render;

    /**
     * MapsMapboxRenderer::parse-error:
     *
     * Indicates that the parsing of the style file failed.
     *
     */
  signals[PARSE_ERROR] =
    g_signal_new ("parse-error",
                  G_OBJECT_CLASS_TYPE (object_class),
                  G_SIGNAL_RUN_LAST,
                  0, NULL, NULL,
                  g_cclosure_marshal_VOID__OBJECT,
                  G_TYPE_NONE,
                  1,
                  G_TYPE_STRING);
}


static void
maps_mapbox_renderer_init (MapsMapboxRenderer *renderer)
{
  renderer->priv = maps_mapbox_renderer_get_instance_private (renderer);
  renderer->priv->data = NULL;
  renderer->priv->size = 0;
  renderer->priv->view = NULL;
}


/**
 * maps_mapbox_renderer_new:
 *
 * Returns: (transfer full): a new #MapsMapboxRenderer object, use g_object_unref() when done.
 *
 */
MapsMapboxRenderer *
maps_mapbox_renderer_new ()
{
  MapsMapboxRenderer *renderer;
  renderer = g_object_new (MAPS_TYPE_MAPBOX_RENDERER, NULL);
}

void
maps_mapbox_renderer_set_view (MapsMapboxRenderer *renderer,
                               ChamplainView *view)
{
  renderer->priv->view = view;
  renderer->priv->layer = maps_mapbox_text_layer_new ();

  champlain_view_add_layer (view, (ChamplainLayer *) renderer->priv->layer);
}

static void
on_stylesheet_changed (GFileMonitor *monitor,
                       GFile *file,
                       GFile *other_file,
                       GFileMonitorEvent event_type,
                       MapsMapboxRenderer *renderer)
{
  if (event_type == G_FILE_MONITOR_EVENT_CHANGED) {
    VTileMapCSS *stylesheet;
    GError *error = NULL;

    stylesheet = vtile_mapcss_new();
    if (!vtile_mapcss_load (stylesheet, g_file_get_path (file), &error)) {
      g_object_unref (stylesheet);
      g_signal_emit_by_name (renderer, "parse-error",
                             g_strdup (error->message));
      return;
    }
    g_object_unref (renderer->priv->stylesheet);
    renderer->priv->stylesheet = stylesheet;

    maps_mapbox_text_layer_remove_all (renderer->priv->layer);
    champlain_view_zoom_out (renderer->priv->view);
    champlain_view_zoom_in (renderer->priv->view);
  }
}

void
maps_mapbox_renderer_load_css (MapsMapboxRenderer *renderer,
                               const char *filename,
                               GError **error)
{
  GFile *file;
  GFileMonitor *monitor;

  renderer->priv->stylesheet = vtile_mapcss_new ();
  vtile_mapcss_load (renderer->priv->stylesheet, filename, error);

  file = g_file_new_for_path (filename);
  monitor = g_file_monitor_file (file, G_FILE_MONITOR_NONE, NULL, NULL);
  g_signal_connect (monitor, "changed",
                    G_CALLBACK (on_stylesheet_changed), renderer);

}

static void
set_data (ChamplainRenderer *renderer_base, const gchar *data, guint size)
{
  MapsMapboxRenderer *renderer = (MapsMapboxRenderer *) renderer_base;

  if (renderer->priv->data)
    g_free (renderer->priv->data);

  renderer->priv->data = g_memdup (data, size);
  renderer->priv->size = size;
}


gboolean
on_canvas_draw (ClutterCanvas *canvas,
                cairo_t *cr,
                gint width,
                gint height,
                RenderData *data)
{
  VTileMapbox *mapbox;
  cairo_surface_t *surface;
  char output[512];
  ClutterActor *actor = NULL;
  GError *error = NULL;
  gboolean success;
  GList *texts, *l;

  mapbox = vtile_mapbox_new (width,
                             champlain_tile_get_zoom_level (data->tile));
  vtile_mapbox_load (mapbox, data->data, data->size, NULL);
  vtile_mapbox_set_stylesheet (mapbox, data->stylesheet);

  cairo_set_operator (cr, CAIRO_OPERATOR_CLEAR);
  cairo_paint (cr);
  cairo_set_operator (cr, CAIRO_OPERATOR_OVER);

  vtile_mapbox_render (mapbox, cr, NULL);

  actor = clutter_actor_new ();
  clutter_actor_set_size (actor,
                          champlain_tile_get_size (data->tile),
                          champlain_tile_get_size (data->tile));
  clutter_actor_set_content (actor, data->canvas);
  g_object_unref (data->canvas);

  texts = vtile_mapbox_get_texts (mapbox);
  for (l = texts; l != NULL; l = l->next) {
    maps_mapbox_text_layer_add_text (data->layer, data->tile, l->data);
  }

  champlain_tile_set_content (data->tile, actor);
  g_signal_emit_by_name (data->tile, "render-complete",
                         data->data, data->size, success);

  g_object_unref (mapbox);
  g_object_unref (data->tile);
  g_free (data->data);
  g_free (data);

  return TRUE;
}

static void
render (ChamplainRenderer *renderer_base, ChamplainTile *tile)
{
  MapsMapboxRenderer *renderer = (MapsMapboxRenderer *) renderer_base;
  RenderData *data;

  if (!renderer->priv->data || renderer->priv->size == 0)
    {
      g_signal_emit_by_name (tile, "render-complete",
                             renderer->priv->data, renderer->priv->size, TRUE);
      return;
    }

  data = g_new0 (RenderData, 1);
  data->tile = g_object_ref (tile);
  data->data = g_memdup (renderer->priv->data, renderer->priv->size);
  data->size = renderer->priv->size;
  data->stylesheet = renderer->priv->stylesheet;
  data->canvas = clutter_canvas_new ();
  data->layer = renderer->priv->layer;
  data->view = renderer->priv->view;

  clutter_canvas_set_size ((ClutterCanvas *) data->canvas,
                           champlain_tile_get_size (tile),
                           champlain_tile_get_size (tile));
  g_signal_connect (data->canvas, "draw",
                    G_CALLBACK (on_canvas_draw), data);
  clutter_content_invalidate (data->canvas);
}
