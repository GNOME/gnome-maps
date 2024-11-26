/*
 * Copyright (C) 2023 James Westman <james@jwestman.net>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <https://www.gnu.org/licenses/>.
 */

#include <librsvg/rsvg.h>
#include <json-glib/json-glib.h>

#include "maps-shield.h"

/*
 * A C port of <https://github.com/ZeLonewolf/openstreetmap-americana/tree/main/shieldlib>
 * from the OpenStreetMap Americana project, which is CC0.
 *
 * We can't use the original Typescript code primarily because tiles are rendered in a
 * separate thread, and GJS doesn't support threads. Also, the upstream code would have
 * to be ported anyway from the canvas API to Cairo and from TS to vanilla JS.
 *
 * The Maps JS code creates a MapsShield object for each network and adds those objects
 * to the MapsSpriteSource. When the sprite source needs to provide a shield sprite, it
 * looks up the appropriate MapsShield object and calls maps_shield_draw().
 */

#define FONT_SIZE_THRESHOLD 12
#define GENERIC_SHIELD_FONT_SIZE 18
#define MAX_FONT_SIZE 14
#define SHIELD_SIZE 20
#define BANNER_HEIGHT 9
#define BANNER_PADDING 1
#define MIN_GENERIC_SHIELD_WIDTH 20
#define MAX_GENERIC_SHIELD_WIDTH 34
#define FONT_FAMILY "Noto Sans Condensed Medium, Noto Sans Condensed, Noto Sans Medium, Noto Sans, sans-serif"

typedef enum {
  TEXT_LAYOUT_UNSET,
  TEXT_LAYOUT_DIAMOND,
  TEXT_LAYOUT_ELLIPSE,
  TEXT_LAYOUT_RECT,
  TEXT_LAYOUT_ROUNDED_RECT,
  TEXT_LAYOUT_SOUTH_HALF_ELLIPSE,
  TEXT_LAYOUT_TRIANGLE_DOWN,
} TextLayout;

typedef struct {
  TextLayout layout;
  double radius;
} TextOptions;

typedef enum {
  SHAPE_UNSET,
  SHAPE_DIAMOND,
  SHAPE_ELLIPSE,
  SHAPE_ESCUTCHEON,
  SHAPE_FISHHEAD,
  SHAPE_HEXAGON_VERTICAL,
  SHAPE_HEXAGON_HORIZONTAL,
  SHAPE_OCTAGON_VERTICAL,
  SHAPE_PENTAGON,
  SHAPE_ROUNDED_RECTANGLE,
  SHAPE_TRAPEZOID,
  SHAPE_TRIANGLE,
  SHAPE_PILL,

  /* Custom shields */
  SHAPE_PA_BELT,
  SHAPE_BRANSON,
} Shape;

typedef struct {
  Shape shape;
  double side_angle;
  GdkRGBA fill;
  double y_offset;
  GdkRGBA outline;
  double outline_width;
  double radius;
  double radius1;
  double radius2;

  double rect_width;

  gboolean rect_width_set;
  gboolean short_side_up;
  gboolean point_up;
  gboolean point_up_set;
} ShapeOptions;

struct _MapsShield {
  GObject parent_instance;

  GdkRGBA text_color;
  GdkRGBA text_halo_color;
  GdkRGBA banner_text_color;
  GdkRGBA banner_text_halo_color;
  GdkRGBA color_lighten;
  GdkRGBA color_darken;

  double padding_left;
  double padding_right;
  double padding_top;
  double padding_bottom;

  char **sprite_blanks;
  char **banners;

  TextOptions text_options;
  ShapeOptions shape_options;

  GHashTable *ref_by_name;

  GHashTable *override_by_ref;
  GHashTable *override_by_name;
  MapsShield *override_noref;

  gboolean romanize_ref : 1;
  gboolean romanize_ref_set : 1;

  gboolean text_color_set : 1;
  gboolean text_halo_color_set : 1;
  gboolean banner_text_color_set : 1;
  gboolean banner_text_halo_color_set : 1;
  gboolean color_lighten_set : 1;
  gboolean color_darken_set : 1;
  gboolean padding_left_set : 1;
  gboolean padding_right_set : 1;
  gboolean padding_top_set : 1;
  gboolean padding_bottom_set : 1;
  gboolean vertical_reflect;
  gboolean vertical_reflect_set : 1;
  gboolean notext_set : 1;
  gboolean notext;

  char *ref;
};

G_DEFINE_TYPE (MapsShield, maps_shield, G_TYPE_OBJECT)

static void maps_shield_set_from_json (MapsShield *self, JsonNode *node,
                                       JsonArray *banners);

/**
 * maps_shield_new:
 * @node: (transfer none): a [class@JsonNode] containing the shield definition
 *
 * Creates a new [class@Shield] instance.
 *
 * Returns: (transfer full): a new [class@Shield] instance
 */
MapsShield *
maps_shield_new (JsonNode *node)
{
  MapsShield *self = g_object_new (MAPS_TYPE_SHIELD, NULL);
  maps_shield_set_from_json (self, node, NULL);
  return self;
}

/**
 * maps_shield_new_with_banners:
 * @node: (transfer none): a [class@JsonNode] containing the shield definition
 * @banners: (transfer none): array of banner texts to add to the shield
 *
 * Creates a new [class@Shield] instance.
 *
 * Returns: (transfer full): a new [class@Shield] instance
 */
MapsShield *
maps_shield_new_with_banners (JsonNode *node, JsonArray *banners)
{
  MapsShield *self = g_object_new (MAPS_TYPE_SHIELD, NULL);
  maps_shield_set_from_json (self, node, banners);
  return self;
}

static void
maps_shield_finalize (GObject *object)
{
  MapsShield *self = MAPS_SHIELD (object);

  g_strfreev (self->sprite_blanks);
  g_strfreev (self->banners);
  g_clear_pointer (&self->ref_by_name, g_hash_table_unref);
  g_clear_pointer (&self->override_by_ref, g_hash_table_unref);
  g_clear_pointer (&self->override_by_name, g_hash_table_unref);
  g_clear_object (&self->override_noref);
  g_clear_pointer (&self->ref, g_free);

  G_OBJECT_CLASS (maps_shield_parent_class)->finalize (object);
}

static void
maps_shield_class_init (MapsShieldClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->finalize = maps_shield_finalize;
}

static void
maps_shield_init (MapsShield *self)
{
  self->banner_text_color = (GdkRGBA){ 0, 0, 0, 1 };
  self->banner_text_halo_color = (GdkRGBA){ 0.976, 0.96, 0.941, 1 };
}

static gboolean
set_color_field (JsonObject *obj,
                 const char *name,
                 GdkRGBA    *field)
{
  const char *color;

  if (!json_object_has_member (obj, name))
    return FALSE;

  color = json_object_get_string_member (obj, name);

  gdk_rgba_parse (field, color);
  return TRUE;
}

static gboolean
set_double_field (JsonObject *obj,
                  const char *name,
                  double     *field)
{
  if (!json_object_has_member (obj, name))
    return FALSE;

  *field = json_object_get_double_member (obj, name);
  return TRUE;
}

static gboolean
set_boolean_field (JsonObject *obj,
                   const char *name,
                   gboolean   *field)
{
  if (!json_object_has_member (obj, name))
    return FALSE;

  *field = json_object_get_boolean_member (obj, name);
  return TRUE;
}

static char **
get_string_array (JsonArray *array)
{
  guint i, n = json_array_get_length (array);
  char **result = g_new0 (char *, n + 1);

  for (i = 0; i < n; i++)
    result[i] = g_strdup (json_array_get_string_element (array, i));

  return result;
}

static void
set_overrides_field (JsonObject  *object,
                     const char  *name,
                     GHashTable **field)
{
  JsonObject *overrides;
  JsonObjectIter iter;
  const char *key;
  JsonNode *value;

  if (!json_object_has_member (object, name))
    return;

  overrides = json_object_get_object_member (object, name);

  json_object_iter_init (&iter, overrides);

  *field = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_object_unref);
  while (json_object_iter_next (&iter, &key, &value))
    g_hash_table_insert (*field, g_strdup (key), maps_shield_new (value));
}

static void
maps_shield_set_from_json (MapsShield *self, JsonNode *node, JsonArray *banners)
{
  JsonObject *object;

  g_return_if_fail (MAPS_IS_SHIELD (self));
  g_return_if_fail (JSON_NODE_HOLDS_OBJECT (node));

  object = json_node_get_object (node);

  self->text_color_set = set_color_field (object, "textColor", &self->text_color);
  self->text_halo_color_set = set_color_field (object, "textHaloColor", &self->text_halo_color);
  self->banner_text_color_set = set_color_field (object, "bannerTextColor", &self->banner_text_color);
  self->banner_text_halo_color_set = set_color_field (object, "bannerTextHaloColor", &self->banner_text_halo_color);

  if (json_object_has_member (object, "padding"))
    {
      JsonObject *padding = json_object_get_object_member (object, "padding");
      self->padding_left_set = set_double_field (padding, "left", &self->padding_left);
      self->padding_right_set = set_double_field (padding, "right", &self->padding_right);
      self->padding_top_set = set_double_field (padding, "top", &self->padding_top);
      self->padding_bottom_set = set_double_field (padding, "bottom", &self->padding_bottom);
    }

  self->color_lighten_set = set_color_field (object, "colorLighten", &self->color_lighten);
  self->color_darken_set = set_color_field (object, "colorDarken", &self->color_darken);

  if (json_object_has_member (object, "spriteBlank"))
    {
      JsonNode *sprite_blanks = json_object_get_member (object, "spriteBlank");

      if (JSON_NODE_HOLDS_ARRAY (sprite_blanks))
        {
          JsonArray *sprite_blanks_array = json_node_get_array (sprite_blanks);
          self->sprite_blanks = get_string_array (sprite_blanks_array);
        }
      else
        {
          self->sprite_blanks = g_new0 (char *, 2);
          self->sprite_blanks[0] = g_strdup (json_node_get_string (sprite_blanks));
        }
    }

  if (banners)
    {
      self->banners = get_string_array (banners);
    }
  else if (json_object_has_member (object, "banners"))
    {
      JsonArray *banners = json_object_get_array_member (object, "banners");
      self->banners = get_string_array (banners);
    }

  if (json_object_has_member (object, "numberingSystem"))
    {
      const char *numbering_system = json_object_get_string_member (object, "numberingSystem");
      if (numbering_system == NULL)
        self->romanize_ref = FALSE;
      else if (g_strcmp0 ("roman", numbering_system) == 0)
        self->romanize_ref = TRUE;
      else
        g_warning ("Unknown numbering system '%s'", numbering_system);

      self->romanize_ref_set = TRUE;
    }

  self->vertical_reflect_set = set_boolean_field (object, "verticalReflect", &self->vertical_reflect);
  self->notext_set = set_boolean_field (object, "notext", &self->notext);

  if (json_object_has_member (object, "refsByName"))
    {
      JsonObject *refs_by_name = json_object_get_object_member (object, "refsByName");
      JsonObjectIter iter;
      const char *name;
      JsonNode *ref_node;

      json_object_iter_init (&iter, refs_by_name);

      self->ref_by_name = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_free);
      while (json_object_iter_next (&iter, &name, &ref_node))
        {
          const char *ref = json_node_get_string (ref_node);
          g_hash_table_insert (self->ref_by_name, g_strdup (name), g_strdup (ref));
        }
    }

  if (json_object_has_member (object, "textLayout"))
    {
      JsonObject *text_layout = json_object_get_object_member (object, "textLayout");
      const char *constraint_func = json_object_get_string_member (text_layout, "constraintFunc");

      if (constraint_func == NULL)
        self->text_options.layout = TEXT_LAYOUT_UNSET;
      else if (g_strcmp0 (constraint_func, "diamond") == 0)
        self->text_options.layout = TEXT_LAYOUT_DIAMOND;
      else if (g_strcmp0 (constraint_func, "ellipse") == 0)
        self->text_options.layout = TEXT_LAYOUT_ELLIPSE;
      else if (g_strcmp0 (constraint_func, "rect") == 0)
        self->text_options.layout = TEXT_LAYOUT_RECT;
      else if (g_strcmp0 (constraint_func, "roundedRect") == 0)
        self->text_options.layout = TEXT_LAYOUT_ROUNDED_RECT;
      else if (g_strcmp0 (constraint_func, "southHalfEllipse") == 0)
        self->text_options.layout = TEXT_LAYOUT_SOUTH_HALF_ELLIPSE;
      else if (g_strcmp0 (constraint_func, "triangleDown") == 0)
        self->text_options.layout = TEXT_LAYOUT_TRIANGLE_DOWN;
      else
        {
          g_warning ("Unknown text layout '%s'", constraint_func);
          return;
        }

      self->text_options.radius = 2;

      if (json_object_has_member (text_layout, "options"))
        {
          JsonObject *options = json_object_get_object_member (text_layout, "options");
          set_double_field (options, "radius", &self->text_options.radius);
        }
    }

  if (json_object_has_member (object, "shapeBlank"))
    {
      JsonObject *shape_blank = json_object_get_object_member (object, "shapeBlank");
      const char *shape = json_object_get_string_member (shape_blank, "drawFunc");
      JsonObject *params = json_object_get_object_member (shape_blank, "params");

      if (shape == NULL)
        self->shape_options.shape = SHAPE_UNSET;
      else if (g_strcmp0 (shape, "diamond") == 0)
        self->shape_options.shape = SHAPE_DIAMOND;
      else if (g_strcmp0 (shape, "ellipse") == 0)
        self->shape_options.shape = SHAPE_ELLIPSE;
      else if (g_strcmp0 (shape, "escutcheon") == 0)
        self->shape_options.shape = SHAPE_ESCUTCHEON;
      else if (g_strcmp0 (shape, "fishhead") == 0)
        self->shape_options.shape = SHAPE_FISHHEAD;
      else if (g_strcmp0 (shape, "hexagonVertical") == 0)
        self->shape_options.shape = SHAPE_HEXAGON_VERTICAL;
      else if (g_strcmp0 (shape, "hexagonHorizontal") == 0)
        self->shape_options.shape = SHAPE_HEXAGON_HORIZONTAL;
      else if (g_strcmp0 (shape, "octagonVertical") == 0)
        self->shape_options.shape = SHAPE_OCTAGON_VERTICAL;
      else if (g_strcmp0 (shape, "pentagon") == 0)
        self->shape_options.shape = SHAPE_PENTAGON;
      else if (g_strcmp0 (shape, "roundedRectangle") == 0)
        self->shape_options.shape = SHAPE_ROUNDED_RECTANGLE;
      else if (g_strcmp0 (shape, "trapezoid") == 0)
        self->shape_options.shape = SHAPE_TRAPEZOID;
      else if (g_strcmp0 (shape, "triangle") == 0)
        self->shape_options.shape = SHAPE_TRIANGLE;
      else if (g_strcmp0 (shape, "paBelt") == 0)
        self->shape_options.shape = SHAPE_PA_BELT;
      else if (g_strcmp0 (shape, "branson") == 0)
        self->shape_options.shape = SHAPE_BRANSON;
      else if (g_strcmp0 (shape, "pill") == 0)
        self->shape_options.shape = SHAPE_PILL;
      else
        {
          g_warning ("Unknown shape '%s'", shape);
          return;
        }

      self->shape_options.point_up_set =
        set_boolean_field (params, "pointUp", &self->shape_options.point_up);

      self->shape_options.outline_width = 1;

      set_double_field (params, "sideAngle", &self->shape_options.side_angle);
      set_color_field (params, "fillColor", &self->shape_options.fill);
      set_double_field (params, "yOffset", &self->shape_options.y_offset);
      set_color_field (params, "strokeColor", &self->shape_options.outline);
      set_double_field (params, "outlineWidth", &self->shape_options.outline_width);
      set_double_field (params, "radius", &self->shape_options.radius);
      set_double_field (params, "radius1", &self->shape_options.radius1);
      set_double_field (params, "radius2", &self->shape_options.radius2);
      set_boolean_field (params, "shortSideUp", &self->shape_options.short_side_up);
      self->shape_options.rect_width_set = set_double_field (params, "rectWidth", &self->shape_options.rect_width);
    }

  set_overrides_field (object, "overrideByRef", &self->override_by_ref);
  set_overrides_field (object, "overrideByName", &self->override_by_name);

  if (json_object_has_member (object, "noref"))
    {
      JsonNode *override_noref = json_object_get_member (object, "noref");
      self->override_noref = maps_shield_new (override_noref);
    }

  if (json_object_has_member (object, "ref"))
    {
      self->ref = g_strdup (json_object_get_string_member (object, "ref"));
    }
}

static MapsShield *
apply_override (MapsShield *self,
                MapsShield *override)
{
  MapsShield *result;

  if (override == NULL)
    return g_object_ref (self);

  result = g_object_new (MAPS_TYPE_SHIELD, NULL);

  result->text_color = override->text_color_set ? override->text_color : self->text_color;
  result->text_color_set = override->text_color_set || self->text_color_set;
  result->text_halo_color = override->text_halo_color_set ? override->text_halo_color : self->text_halo_color;
  result->text_halo_color_set = override->text_halo_color_set || self->text_halo_color_set;
  result->color_lighten = override->color_lighten_set ? override->color_lighten : self->color_lighten;
  result->color_lighten_set = override->color_lighten_set || self->color_lighten_set;
  result->color_darken = override->color_darken_set ? override->color_darken : self->color_darken;
  result->color_darken_set = override->color_darken_set || self->color_darken_set;

  result->padding_left = override->padding_left_set ? override->padding_left : self->padding_left;
  result->padding_left_set = override->padding_left_set || self->padding_left_set;
  result->padding_right = override->padding_right_set ? override->padding_right : self->padding_right;
  result->padding_right_set = override->padding_right_set || self->padding_right_set;
  result->padding_top = override->padding_top_set ? override->padding_top : self->padding_top;
  result->padding_top_set = override->padding_top_set || self->padding_top_set;
  result->padding_bottom = override->padding_bottom_set ? override->padding_bottom : self->padding_bottom;
  result->padding_bottom_set = override->padding_bottom_set || self->padding_bottom_set;
  result->romanize_ref = override->romanize_ref_set ? override->romanize_ref : self->romanize_ref;
  result->vertical_reflect = override->vertical_reflect_set ? override->vertical_reflect : self->vertical_reflect;
  result->notext = override->notext_set ? override->notext : self->notext;

  result->sprite_blanks = g_strdupv (override->sprite_blanks != NULL ? override->sprite_blanks : self->sprite_blanks);
  result->banners = g_strdupv (override->banners != NULL ? override->banners : self->banners);

  result->text_options = override->text_options.layout != TEXT_LAYOUT_UNSET ? override->text_options : self->text_options;
  result->shape_options = override->shape_options.shape != SHAPE_UNSET ? override->shape_options : self->shape_options;

  result->ref = g_strdup (override->ref ? override->ref : self->ref);

  return result;
}


typedef struct {
  MapsShield *shield;
  const char *ref;
  const char *name;
  double scale;
  cairo_t *cr;
} RenderCtx;

typedef enum {
  ALIGN_TOP,
  ALIGN_MIDDLE,
  ALIGN_BOTTOM,
} VAlign;

static PangoLayout *
create_pango_layout (RenderCtx *ctx)
{
  if (ctx->cr != NULL)
    return pango_cairo_create_layout (ctx->cr);
  else
    {
      PangoContext *pango_context = pango_font_map_create_context (pango_cairo_font_map_get_default ());
      PangoLayout *layout = pango_layout_new (pango_context);
      g_object_unref (pango_context);
      return layout;
    }
}

static double
ellipse_scale (double avail_width,
               double avail_height,
               double text_width,
               double text_height)
{
  return (avail_width * avail_height)
    / sqrt (avail_width * avail_width * text_height * text_height
            + avail_height * avail_height * text_width * text_width);
}

static void
text_layout_func (RenderCtx *ctx,
                  double avail_width,
                  double avail_height,
                  double text_width,
                  double text_height,
                  double *scale,
                  VAlign *valign)
{
  double set_scale = 1.0;
  VAlign set_valign = ALIGN_MIDDLE;

  switch (ctx->shield->text_options.layout)
    {
    case TEXT_LAYOUT_UNSET:
    case TEXT_LAYOUT_RECT:
      set_scale = MIN (avail_width / text_width, avail_height / text_height);
      break;
    case TEXT_LAYOUT_DIAMOND:
      set_scale = (avail_width * avail_height) / (avail_height * text_width + avail_width * text_height);
      break;
    case TEXT_LAYOUT_ELLIPSE:
      set_scale = ellipse_scale (avail_width, avail_height, text_width, text_height);
      break;
    case TEXT_LAYOUT_ROUNDED_RECT:
      {
        double constraint_radius = ctx->shield->text_options.radius * (2 - G_SQRT2);
        avail_width -= constraint_radius;
        avail_height -= constraint_radius;
        set_scale = MIN (avail_width / text_width, avail_height / text_height);
        break;
      }
    case TEXT_LAYOUT_SOUTH_HALF_ELLIPSE:
      set_scale = ellipse_scale (avail_width, avail_height, text_height, text_width / 2);
      set_valign = ALIGN_TOP;
      break;
    case TEXT_LAYOUT_TRIANGLE_DOWN:
      set_scale = (avail_width * avail_height) / (avail_height * text_width + avail_width * text_height);
      set_valign = ALIGN_TOP;
      break;
    }

  if (scale != NULL)
    *scale = set_scale;
  if (valign != NULL)
    *valign = set_valign;
}

static double
calculate_text_width (RenderCtx *ctx)
{
  g_autoptr(PangoLayout) layout = create_pango_layout (ctx);
  g_autoptr(PangoFontDescription) font_desc = pango_font_description_new ();
  PangoRectangle extent;

  if (ctx->ref == NULL)
    return 0;

  pango_layout_set_text (layout, ctx->ref, -1);
  pango_font_description_set_family (font_desc, FONT_FAMILY);
  pango_font_description_set_weight (font_desc, PANGO_WEIGHT_MEDIUM);
  pango_font_description_set_stretch (font_desc, PANGO_STRETCH_CONDENSED);
  pango_font_description_set_absolute_size (font_desc, PANGO_SCALE * GENERIC_SHIELD_FONT_SIZE);
  pango_layout_set_font_description (layout, font_desc);

  pango_layout_get_extents (layout, &extent, NULL);
  return extent.width / (double) PANGO_SCALE;
}

static void
layout_shield_text (RenderCtx *ctx,
                    double width,
                    double height,
                    double *x,
                    double *y,
                    double *font_size,
                    PangoLayout **layout_out)
{
  g_autoptr(PangoLayout) layout = create_pango_layout (ctx);
  g_autoptr(PangoFontDescription) font_desc = pango_font_description_new ();
  PangoRectangle extent;
  double text_width, text_height;
  double avail_width, avail_height;
  double scale;
  double set_font_size;
  VAlign valign;

  pango_layout_set_text (layout, ctx->ref, -1);
  pango_font_description_set_family (font_desc, FONT_FAMILY);
  pango_font_description_set_weight (font_desc, PANGO_WEIGHT_MEDIUM);
  pango_font_description_set_stretch (font_desc, PANGO_STRETCH_CONDENSED);

  pango_font_description_set_absolute_size (font_desc, PANGO_SCALE * FONT_SIZE_THRESHOLD);
  pango_layout_set_font_description (layout, font_desc);

  pango_layout_get_extents (layout, &extent, NULL);
  text_width = extent.width / (double) PANGO_SCALE;
  text_height = extent.height / (double) PANGO_SCALE;

  avail_width = width - ctx->shield->padding_left - ctx->shield->padding_right;
  avail_height = height - ctx->shield->padding_top - ctx->shield->padding_bottom;

  text_layout_func (ctx, avail_width, avail_height, text_width, text_height, &scale, &valign);

  set_font_size = MIN (MAX_FONT_SIZE, FONT_SIZE_THRESHOLD * scale);

  pango_font_description_set_absolute_size (font_desc, PANGO_SCALE * set_font_size);
  pango_layout_set_font_description (layout, font_desc);

  pango_layout_get_extents (layout, &extent, NULL);
  text_width = extent.width / (double) PANGO_SCALE;
  text_height = extent.height / (double) PANGO_SCALE;

  if (x != NULL)
    *x = ctx->shield->padding_left + (avail_width - text_width) / 2;

  if (y != NULL)
    {
      switch (valign)
        {
        case ALIGN_TOP:
          *y = ctx->shield->padding_top;
          break;
        case ALIGN_MIDDLE:
          *y = ctx->shield->padding_top + (avail_height - text_height) / 2;
          break;
        case ALIGN_BOTTOM:
          *y = ctx->shield->padding_top + avail_height - text_height;
          break;
        }
    }

  if (font_size != NULL)
    *font_size = set_font_size;
  if (layout_out != NULL)
    *layout_out = g_steal_pointer (&layout);
}


static RsvgHandle *
get_raster_shield_blank (RenderCtx *ctx)
{
  /* Loads a blank shield image. Unlike the original OSM Americana code,
    we load the image directly from gresources, rather than from the spritesheet.
    This is because the MapsSpriteSource code loads images as icons at a standard
    size, not at the image's original size. */

  RsvgHandle *handle = NULL;
  double width, height;
  double font_size;

  if (ctx->shield->sprite_blanks == NULL)
    return NULL;

  for (int i = 0; ctx->shield->sprite_blanks[i] != NULL; i++)
    {
      g_autofree char *resource_name = g_strdup_printf ("/org/gnome/Maps/shields/%s.svg", ctx->shield->sprite_blanks[i]);
      g_autoptr(GBytes) bytes = NULL;

      g_clear_object (&handle);

      bytes = g_resources_lookup_data (resource_name, G_RESOURCE_LOOKUP_FLAGS_NONE, NULL);
      if (bytes == NULL)
        {
          g_warning ("Failed to load data for shield blank '%s'", ctx->shield->sprite_blanks[i]);
          return NULL;
        }

      handle = rsvg_handle_new_from_data (g_bytes_get_data (bytes, NULL), g_bytes_get_size (bytes), NULL);
      if (handle == NULL)
        {
          g_warning ("Failed to load RsvgHandle for shield blank '%s'", ctx->shield->sprite_blanks[i]);
          return NULL;
        }

      if (ctx->ref == NULL)
        break;

      rsvg_handle_get_intrinsic_size_in_pixels (handle, &width, &height);

      layout_shield_text (ctx, width, height, NULL, NULL, &font_size, NULL);

      if (font_size > FONT_SIZE_THRESHOLD)
        break;
    }

  return handle;
}

static void
romanize_repeat_char (GString *string, char c, int *n, int sub)
{
  while (*n >= sub)
    {
      g_string_append_c (string, c);
      *n -= sub;
    }
}

static char *
romanize_ref (const char *ref)
{
  /* Convert a ref to roman numerals. */

  char *end;
  g_autoptr(GString) result = g_string_new (NULL);
  int ref_num = g_ascii_strtoll (ref, &end, 10);

  if (ref_num == 0)
    return g_strdup (ref);

  romanize_repeat_char (result, 'M', &ref_num, 1000);
  romanize_repeat_char (result, 'D', &ref_num, 500);
  romanize_repeat_char (result, 'C', &ref_num, 100);
  romanize_repeat_char (result, 'L', &ref_num, 50);
  romanize_repeat_char (result, 'X', &ref_num, 10);
  romanize_repeat_char (result, 'V', &ref_num, 5);
  romanize_repeat_char (result, 'I', &ref_num, 1);

  g_string_replace (result, "DCCCC", "CM", 0);
  g_string_replace (result, "CCCC", "CD", 0);
  g_string_replace (result, "LXXXX", "XC", 0);
  g_string_replace (result, "XXXX", "XL", 0);
  g_string_replace (result, "VIIII", "IX", 0);
  g_string_replace (result, "IIII", "IV", 0);

  g_string_append (result, end);

  return g_string_free (g_steal_pointer (&result), FALSE);
}

static cairo_pattern_t *
create_pattern (RsvgHandle *sprite, RenderCtx *ctx)
{
  double width, height;
  cairo_surface_t *surface;
  cairo_t *source_cr;
  cairo_pattern_t *pattern;
  cairo_matrix_t matrix;

  rsvg_handle_get_intrinsic_size_in_pixels (sprite, &width, &height);
  width *= ctx->scale;
  height *= ctx->scale;
  surface = cairo_image_surface_create (CAIRO_FORMAT_ARGB32, width, height);
  source_cr = cairo_create (surface);

  rsvg_handle_render_document (sprite, source_cr, &((RsvgRectangle) {
    .x = 0,
    .y = 0,
    .width = width,
    .height = height,
  }), NULL);

  pattern = cairo_pattern_create_for_surface (surface);
  cairo_matrix_init_identity (&matrix);

  if (ctx->shield->vertical_reflect)
    {
      cairo_matrix_translate (&matrix, 0, height / 2);
      cairo_matrix_scale (&matrix, 1, -1);
      cairo_matrix_translate (&matrix, 0, -height / 2);
    }
  cairo_matrix_scale (&matrix, ctx->scale, ctx->scale);

  cairo_pattern_set_matrix (pattern, &matrix);

  cairo_surface_destroy (surface);
  cairo_destroy (source_cr);

  return pattern;
}

static double
compute_width (RenderCtx *ctx)
{
  ShapeOptions *shape = &ctx->shield->shape_options;
  double shield_width;
  double min_width = MIN_GENERIC_SHIELD_WIDTH;

  if (shape->rect_width_set)
    return shape->rect_width;

  shield_width = calculate_text_width (ctx) + 2;

  switch (shape->shape)
    {
    case SHAPE_PENTAGON:
      shield_width += ((SHIELD_SIZE - shape->y_offset) * tan (shape->side_angle)) / 2;
      break;
    case SHAPE_TRAPEZOID:
      shield_width += (SHIELD_SIZE * tan (shape->side_angle)) / 2;
      break;
    case SHAPE_TRIANGLE:
      min_width += 2;
      break;
    case SHAPE_DIAMOND:
    case SHAPE_HEXAGON_HORIZONTAL:
      min_width += 4;
      break;
    default:
      break;
    }

  return MAX (min_width, MIN (MAX_GENERIC_SHIELD_WIDTH, shield_width));
}

static double
shape_height (RenderCtx *ctx)
{
  if (ctx->shield->shape_options.shape == SHAPE_DIAMOND)
    return SHIELD_SIZE + 4;
  else
    return SHIELD_SIZE;
}

static void
get_drawn_shield_bounds (RenderCtx *ctx, double *width, double *height)
{
  *width = MAX (SHIELD_SIZE, compute_width (ctx));
  *height = shape_height (ctx);
}

static void
draw_banners (RenderCtx *ctx, double width)
{
  if (ctx->shield->banners == NULL)
    return;

  for (int i = 0; ctx->shield->banners[i] != NULL; i++)
    {
      const char *banner = ctx->shield->banners[i];
      g_autoptr(PangoLayout) layout = create_pango_layout (ctx);
      g_autoptr(PangoFontDescription) font_desc = pango_font_description_new ();
      PangoRectangle extent;
      double text_width, text_height, scale;

      pango_layout_set_text (layout, banner, -1);
      pango_font_description_set_family (font_desc, FONT_FAMILY);
      pango_font_description_set_weight (font_desc, PANGO_WEIGHT_MEDIUM);
      pango_font_description_set_stretch (font_desc, PANGO_STRETCH_CONDENSED);

      pango_font_description_set_absolute_size (font_desc, PANGO_SCALE * FONT_SIZE_THRESHOLD);
      pango_layout_set_font_description (layout, font_desc);

      pango_layout_get_extents (layout, &extent, NULL);
      text_width = (extent.x + extent.width) / (double) PANGO_SCALE + 2;
      text_height = (extent.y + extent.height) / (double) PANGO_SCALE + 2;
      scale = MIN (BANNER_HEIGHT / text_height, width / text_width);

      pango_font_description_set_absolute_size (font_desc, PANGO_SCALE * FONT_SIZE_THRESHOLD * scale);
      pango_layout_set_font_description (layout, font_desc);

      pango_layout_get_extents (layout, &extent, NULL);
      text_width = (extent.x + extent.width) / (double) PANGO_SCALE;
      text_height = (extent.y + extent.height) / (double) PANGO_SCALE;

      cairo_save (ctx->cr);

      cairo_move_to (ctx->cr, (width - text_width) / 2, i * BANNER_HEIGHT);
      pango_cairo_layout_path (ctx->cr, layout);

      gdk_cairo_set_source_rgba (ctx->cr, &ctx->shield->banner_text_halo_color);
      cairo_set_line_width (ctx->cr, 2);
      cairo_stroke_preserve (ctx->cr);

      gdk_cairo_set_source_rgba (ctx->cr, &ctx->shield->banner_text_color);
      cairo_fill (ctx->cr);

      cairo_restore (ctx->cr);
    }
}

static void
rounded_rect (cairo_t *cr, double width, double height, double radius, double half_outline_width)
{
  cairo_arc (cr, width - radius - half_outline_width, radius + half_outline_width, radius, -G_PI / 2, 0);
  cairo_arc (cr, width - radius - half_outline_width, height - radius - half_outline_width, radius, 0, G_PI / 2);
  cairo_arc (cr, radius + half_outline_width, height - radius - half_outline_width, radius, G_PI / 2, G_PI);
  cairo_arc (cr, radius + half_outline_width, radius + half_outline_width, radius, G_PI, 3 * G_PI / 2);
  cairo_close_path (cr);
}

static void
arc_to (cairo_t *cr, double x1, double y1, double x2, double y2, double radius)
{
  /* Implement canvas's arcTo() in terms of cairo's arc().
     See <https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/arcTo>.
     Based on the implementation in <https://github.com/Automattic/node-canvas/blob/master/src/CanvasRenderingContext2d.cc>,
     which is MIT licensed. */

  double x0, y0;

  cairo_get_current_point (cr, &x0, &y0);

  if ((x1 == x0 && y1 == y0) || (x1 == x2 && y1 == y2) || radius == 0) {
    cairo_line_to (cr, x1, y1);
    return;
  }

  double p1p0_x = x0 - x1;
  double p1p0_y = y0 - y1;
  double p1p2_x = x2 - x1;
  double p1p2_y = y2 - y1;
  double p1p0_length = sqrt (p1p0_x * p1p0_x + p1p0_y * p1p0_y);
  double p1p2_length = sqrt (p1p2_x * p1p2_x + p1p2_y * p1p2_y);

  double cos_phi = (p1p0_x * p1p2_x + p1p0_y * p1p2_y) / (p1p0_length * p1p2_length);

  if (cos_phi == -1)
    {
      cairo_line_to (cr, x1, y1);
      return;
    }

  if (1 == cos_phi)
    {
      double factor_max = 65535 / p1p0_length;
      double ep_x = x0 + factor_max * p1p0_x;
      double ep_y = y0 + factor_max * p1p0_y;
      cairo_line_to (cr, ep_x, ep_y);
      return;
    }

  double tangent = radius / tan (acos (cos_phi) / 2);
  double factor_p1p0 = tangent / p1p0_length;
  double t_p1p0_x = (x1 + factor_p1p0 * p1p0_x);
  double t_p1p0_y = (y1 + factor_p1p0 * p1p0_y);

  double orth_p1p0_x = p1p0_y;
  double orth_p1p0_y = -p1p0_x;
  double orth_p1p0_length = sqrt (orth_p1p0_x * orth_p1p0_x + orth_p1p0_y * orth_p1p0_y);
  double factor_ra = radius / orth_p1p0_length;

  double cos_alpha = (orth_p1p0_x * p1p2_x + orth_p1p0_y * p1p2_y) / (orth_p1p0_length * p1p2_length);
  if (cos_alpha < 0)
    {
      orth_p1p0_x = -orth_p1p0_x;
      orth_p1p0_y = -orth_p1p0_y;
    }

  double p_x = t_p1p0_x + factor_ra * orth_p1p0_x;
  double p_y = t_p1p0_y + factor_ra * orth_p1p0_y;

  orth_p1p0_x = -orth_p1p0_x;
  orth_p1p0_y = -orth_p1p0_y;
  double sa = acos (orth_p1p0_x / orth_p1p0_length);
  if (orth_p1p0_y < 0)
      sa = 2 * G_PI - sa;

  gboolean anticlockwise = FALSE;

  double factor_p1p2 = tangent / p1p2_length;
  double t_p1p2_x = x1 + factor_p1p2 * p1p2_x;
  double t_p1p2_y = y1 + factor_p1p2 * p1p2_y;
  double orth_p1p2_x = t_p1p2_x - p_x;
  double orth_p1p2_y = t_p1p2_y - p_y;
  double orth_p1p2_length = sqrt (orth_p1p2_x * orth_p1p2_x + orth_p1p2_y * orth_p1p2_y);
  double ea = acos (orth_p1p2_x / orth_p1p2_length);

  if (orth_p1p2_y < 0)
    ea = 2 * G_PI - ea;
  if ((sa > ea) && ((sa - ea) < G_PI))
    anticlockwise = TRUE;
  if ((sa < ea) && ((ea - sa) > G_PI))
    anticlockwise = TRUE;

  cairo_line_to (cr, t_p1p0_x, t_p1p0_y);

  if (anticlockwise && G_PI * 2 != radius)
    cairo_arc_negative (cr, p_x, p_y, radius, sa, ea);
  else
    cairo_arc (cr, p_x, p_y, radius, sa, ea);
}

static void
draw_shield (RenderCtx *ctx, double width, double height, double banner_height)
{
  double outline_width = ctx->shield->shape_options.outline_width;
  double half_outline_width = outline_width / 2;

  cairo_save (ctx->cr);
  cairo_translate (ctx->cr, 0, banner_height);

  switch (ctx->shield->shape_options.shape)
    {
    case SHAPE_UNSET:
      break;

    case SHAPE_ELLIPSE:
      {
        double radius_x = (width - outline_width) / 2;
        double radius_y = (height - outline_width) / 2;
        cairo_matrix_t matrix;

        cairo_get_matrix (ctx->cr, &matrix);

        cairo_translate (ctx->cr, width / 2, height / 2);
        cairo_scale (ctx->cr, radius_x, radius_y);
        cairo_translate (ctx->cr, -width / 2, -height / 2);
        cairo_arc (
          ctx->cr,
          width / 2,
          height / 2,
          1,
          0,
          2 * G_PI
        );
        cairo_set_matrix (ctx->cr, &matrix);
        break;
      }

    case SHAPE_ROUNDED_RECTANGLE:
      rounded_rect (ctx->cr, width, height, ctx->shield->shape_options.radius, half_outline_width);
      break;

    case SHAPE_PILL:
      rounded_rect (ctx->cr, width, height, height / 2, half_outline_width);
      break;

    case SHAPE_ESCUTCHEON:
      {
        double y_offset = ctx->shield->shape_options.y_offset;
        double radius = ctx->shield->shape_options.radius;

        double x0 = half_outline_width;
        double x5 = width - half_outline_width;

        double y0 = half_outline_width;
        double y5 = height - half_outline_width;

        double x1 = x0 + radius;
        double x3 = (x0 + x5) / 2;

        double y1 = y0 + radius;
        double y2 = y5 - y_offset;

        double x2 = (2 * x0 + x3) / 3;
        double x4 = (x3 + 2 * x5) / 3;
        double y3 = (y2 + y5) / 2;

        double y4 = (y3 + 2 * y5) / 3;

        cairo_move_to (ctx->cr, x3, y5);
        cairo_curve_to (ctx->cr, x2, y4, x0, y3, x0, y2);
        arc_to (ctx->cr, x0, y0, x1, y0, radius);
        arc_to (ctx->cr, x5, y0, x5, y1, radius);
        /* Right side */
        cairo_line_to (ctx->cr, x5, y2);
        /* Right curve */
        cairo_curve_to (ctx->cr, x5, y3, x4, y4, x3, y5);

        break;
      }

    case SHAPE_FISHHEAD:
      {
        gboolean point_up =
          ctx->shield->shape_options.point_up_set ?
          ctx->shield->shape_options.point_up : FALSE;

        double angle_sign = point_up ? -1 : 1;

        double x0 = half_outline_width;
        double x8 = width - half_outline_width;

        double y0 = point_up ? height - outline_width : outline_width;
        double y6 = point_up ? outline_width : height - outline_width;

        double x1 = x0 + 1;
        double x2 = x0 + 2.5;
        double x4 = (x0 + x8) / 2;
        double x6 = x8 - 2.5;
        double x7 = x8 - 1;
        double y1 = y0 + angle_sign * 2;
        double y2 = y0 + angle_sign * 4.5;
        double y3 = y0 + angle_sign * 7;
        double y4 = y6 - angle_sign * 6;
        double y5 = y6 - angle_sign * 1;

        double x3 = (x0 + x4) / 2;
        double x5 = (x4 + x8) / 2;

        cairo_move_to (ctx->cr, x4, y6);
        cairo_curve_to (ctx->cr, x3, y5, x0, y4, x0, y3);
        cairo_curve_to (ctx->cr, x0, y2, x1, y1, x2, y0);
        cairo_line_to(ctx->cr, x6, y0);
        cairo_curve_to (ctx->cr, x7, y1, x8, y2, x8, y3);
        cairo_curve_to (ctx->cr, x8, y4, x5, y5, x4, y6);

        break;
      }

    case SHAPE_TRIANGLE:
      {
        gboolean point_up =
          ctx->shield->shape_options.point_up_set ?
          ctx->shield->shape_options.point_up : TRUE;
        double radius = ctx->shield->shape_options.radius;

        double angle_sign = point_up ? -1 : 1;

        double x0 = half_outline_width;
        double x8 = width - half_outline_width;
        double y0 = point_up ? height - half_outline_width : half_outline_width;
        double y5 = point_up ? half_outline_width : height - half_outline_width;

        double x2 = x0 + radius;
        double x4 = (x0 + x8) / 2;
        double x6 = x8 - radius;
        double y1 = y0 + angle_sign * radius;

        double angle = atan2 (x4 - x2, abs (y5 - radius - y1));
        double sine = sin (angle);
        double cosine = cos (angle);
        double half_tangent = tan (angle / 2);
        double half_complement_tangent = tan (G_PI / 4 - angle / 2);

        double x1 = x2 - radius * cosine;
        double x3 = x4 - radius * half_complement_tangent;
        double x5 = x4 + radius * half_complement_tangent;
        double x7 = x6 + radius * cosine;
        double y2 = y1 + angle_sign * radius * half_tangent;
        double y3 = y1 + angle_sign * radius * sine;

        cairo_move_to (ctx->cr, x4, y5);
        arc_to (ctx->cr, x3, y5, x1, y3, radius);
        arc_to (ctx->cr, x0, y2, x0, y1, radius);
        arc_to (ctx->cr, x0, y0, x2, y0, radius);
        arc_to (ctx->cr, x8, y0, x8, y1, radius);
        arc_to (ctx->cr, x8, y2, x7, y3, radius);
        arc_to (ctx->cr, x5, y5, x4, y5, radius);
        cairo_close_path (ctx->cr);

        break;
      }

    case SHAPE_TRAPEZOID:
      {
        gboolean short_side_up = ctx->shield->shape_options.short_side_up;
        double side_angle = ctx->shield->shape_options.side_angle;
        double radius = ctx->shield->shape_options.radius;

        double angle_sign = short_side_up ? -1 : 1;

        double sine = sin (side_angle);
        double cosine = cos (side_angle);
        double tangent = tan (side_angle);

        double x0 = half_outline_width;
        double x9 = width - half_outline_width;
        double y0 = short_side_up ? height - half_outline_width : half_outline_width;
        double y3 = short_side_up ? half_outline_width : height - half_outline_width;

        double y1 = y0 + angle_sign * radius * (1 + sine);
        double y2 = y3 - angle_sign * radius * (1 - sine);

        double x1 = x0 + (y1 - y0) * tangent;
        double x2 = x1 + radius * cosine;
        double x3 = x0 + angle_sign * (y2 - y0) * tangent;
        double x4 = x0 + angle_sign * (y3 - y0) * tangent;
        double x5 = x3 + angle_sign * radius * cosine;
        double x6 = width - x4;
        double x7 = width - x3;
        double x8 = width - x2;

        cairo_move_to (ctx->cr, x8, y0);
        arc_to (ctx->cr, x9, y0, x7, y2, radius);
        arc_to (ctx->cr, x6, y3, x5, y3, radius);
        arc_to (ctx->cr, x4, y3, x1, y1, radius);
        arc_to (ctx->cr, x0, y0, x8, y0, radius);
        cairo_close_path (ctx->cr);

        break;
      }

    case SHAPE_DIAMOND:
      {
        double radius = ctx->shield->shape_options.radius;

        double x0 = half_outline_width;
        double x8 = width - half_outline_width;
        double y0 = half_outline_width;
        double y8 = height - half_outline_width;

        double x4 = (x0 + x8) / 2;
        double y4 = (y0 + y8) / 2;

        double angle = atan2 (x4 - radius - x0, y8 - radius - y4);
        double sine = sin (angle);
        double cosine = cos (angle);
        double half_tangent = tan (angle / 2);
        double half_complement_tangent = tan (G_PI / 4 - angle / 2);

        double x1 = x0 + radius * (1 - cosine);
        double x2 = x4 - radius * cosine;
        double x3 = x4 - radius * half_complement_tangent;
        double x5 = x4 + radius * half_complement_tangent;
        double x6 = x4 + radius * cosine;
        double x7 = x8 - radius * (1 - cosine);

        double y1 = y0 + radius * (1 - sine);
        double y2 = y4 - radius * sine;
        double y3 = y4 - radius * half_tangent;
        double y5 = y4 + radius * half_tangent;
        double y6 = y4 + radius * sine;
        double y7 = y8 - radius * (1 - sine);

        cairo_move_to (ctx->cr, x4, y8);
        arc_to (ctx->cr, x3, y8, x1, y6, radius);
        arc_to (ctx->cr, x0, y5, x0, y4, radius);
        arc_to (ctx->cr, x0, y3, x2, y1, radius);
        arc_to (ctx->cr, x3, y0, x4, y0, radius);
        arc_to (ctx->cr, x5, y0, x7, y2, radius);
        arc_to (ctx->cr, x8, y3, x8, y4, radius);
        arc_to (ctx->cr, x8, y5, x6, y7, radius);
        arc_to (ctx->cr, x5, y8, x4, y8, radius);
        cairo_close_path (ctx->cr);

        break;
      }

    case SHAPE_PENTAGON:
      {
        gboolean point_up =
          ctx->shield->shape_options.point_up_set ?
          ctx->shield->shape_options.point_up : TRUE;

        double angle_sign = point_up ? -1 : 1;
        double side_angle = ctx->shield->shape_options.side_angle;
        double sine = sin (side_angle);
        double cosine = cos (side_angle);
        double tangent = tan (side_angle);

        double radius1 = ctx->shield->shape_options.radius1;
        double radius2 = ctx->shield->shape_options.radius2;
        double y_offset = ctx->shield->shape_options.y_offset;

        double x0 = half_outline_width;
        double x8 = width - half_outline_width;
        double y0 = point_up ? height - half_outline_width : half_outline_width;
        double y3 = point_up ? half_outline_width : height - half_outline_width;

        double y2 = y3 - angle_sign * y_offset;

        double x2 = x0 + angle_sign * (y2 - y0) * tangent;
        double x4 = (x0 + x8) / 2;
        double x6 = x8 - angle_sign * (y2 - y0) * tangent;

        double y_offset_angle = atan2 (y_offset, x4 - x0);

        double half_complement_angle1 = (G_PI / 2 - y_offset_angle + side_angle) / 2;
        double half_complement_tangent1 = tan (half_complement_angle1);

        double half_complement_angle2 = (G_PI / 2 - side_angle) / 2;
        double half_complement_tangent2 = tan (half_complement_angle2);

        double x1 = x0 + radius1 * half_complement_tangent1 * sine;
        double x3 = x2 + radius2 * half_complement_tangent2;
        double x5 = x6 - radius2 * half_complement_tangent2;
        double x7 = x8 - radius1 * half_complement_tangent1 * sine;
        double y1 = y2 - angle_sign * radius1 * half_complement_tangent1 * cosine;

        cairo_move_to (ctx->cr, x4, y3);
        arc_to (ctx->cr, x0, y2, x1, y1, radius1);
        arc_to (ctx->cr, x2, y0, x3, y0, radius2);
        cairo_line_to (ctx->cr, x5, y0);
        arc_to (ctx->cr, x6, y0, x7, y1, radius2);
        arc_to (ctx->cr, x8, y2, x4, y3, radius1);
        cairo_close_path (ctx->cr);

        break;
      }

    case SHAPE_HEXAGON_VERTICAL:
      {
        double radius = ctx->shield->shape_options.radius;
        double y_offset = ctx->shield->shape_options.y_offset;

        double x0 = half_outline_width;
        double x2 = width - half_outline_width;
        double y0 = half_outline_width;
        double y5 = height - half_outline_width;

        double x1 = (x0 + x2) / 2;
        double y1 = y0 + y_offset;
        double y4 = y5 - y_offset;

        double draw_y_offset_tangent = radius * tan (G_PI / 4 - asin (y_offset / (x1 - x0)) / 2);
        double y2 = y1 + draw_y_offset_tangent;
        double y3 = y4 - draw_y_offset_tangent;

        cairo_move_to (ctx->cr, x1, y5);
        arc_to (ctx->cr, x0, y4, x0, y3, radius);
        arc_to (ctx->cr, x0, y1, x1, y0, radius);
        cairo_line_to (ctx->cr, x1, y0);
        arc_to (ctx->cr, x2, y1, x2, y2, radius);
        arc_to (ctx->cr, x2, y4, x1, y5, radius);
        cairo_line_to (ctx->cr, x1, y5);
        cairo_close_path (ctx->cr);

        break;
      }

    case SHAPE_HEXAGON_HORIZONTAL:
      {
        double side_angle = ctx->shield->shape_options.side_angle;
        double radius = ctx->shield->shape_options.radius;

        double sine = sin (side_angle);
        double cosine = cos (side_angle);
        double tangent = tan (side_angle);
        double half_complement_tangent = tan (G_PI / 4 - side_angle / 2);

        double x0 = half_outline_width;
        double x9 = width - half_outline_width;
        double y0 = half_outline_width;
        double y6 = height - half_outline_width;

        double y3 = (y0 + y6) / 2;

        double y1 = y0 + radius * half_complement_tangent * cosine;
        double y2 = y3 - radius * sine;
        double y4 = y3 + radius * sine;
        double y5 = y6 - radius * half_complement_tangent * cosine;

        double x1 = x0 + (y3 - y2) * tangent;
        double x3 = x0 + (y3 - y0) * tangent;
        double x6 = x9 - (y3 - y0) * tangent;
        double x8 = x9 - (y3 - y2) * tangent;

        double x2 = x3 - radius * half_complement_tangent * sine;
        double x4 = x3 + radius * half_complement_tangent;
        double x5 = x6 - radius * half_complement_tangent;
        double x7 = x6 + radius * half_complement_tangent * sine;

        cairo_move_to (ctx->cr, x4, y0);
        arc_to (ctx->cr, x6, y0, x7, y1, radius);
        arc_to (ctx->cr, x9, y3, x8, y4, radius);
        arc_to (ctx->cr, x6, y6, x5, y6, radius);
        arc_to (ctx->cr, x3, y6, x2, y5, radius);
        arc_to (ctx->cr, x0, y3, x1, y2, radius);
        arc_to (ctx->cr, x3, y0, x4, y0, radius);
        cairo_close_path (ctx->cr);

        break;
      }

    case SHAPE_PA_BELT:
      {
        /* Special case for Allegheny, Pennsylvania color-coded routes */

        /* Background rectangle */
        rounded_rect (ctx->cr, width, height, 2, 0.5);
        cairo_set_source_rgba (ctx->cr, 1, 1, 1, 1);
        cairo_fill_preserve (ctx->cr);
        cairo_set_source_rgba (ctx->cr, 0, 0, 0, 1);
        cairo_set_line_width (ctx->cr, 1);
        cairo_stroke (ctx->cr);

        /* Circle */
        cairo_arc (ctx->cr, width / 2, height / 2, width / 3 - 0.5, 0, 2 * G_PI);
        outline_width = 0.5;

        break;
      }

    case SHAPE_OCTAGON_VERTICAL:
      {
        double radius = ctx->shield->shape_options.radius;
        double y_offset = ctx->shield->shape_options.y_offset;
        double side_angle = ctx->shield->shape_options.side_angle;

        double sine = sin (side_angle);
        double cosine = cos (side_angle);
        double tangent = tan (side_angle);

        double x0 = half_outline_width;
        double x10 = width - half_outline_width;
        double y0 = half_outline_width;
        double y10 = height - half_outline_width;

        double x1 = x0 + radius * tangent * sine;
        double x5 = (x0 + x10) / 2;
        double x9 = x10 - radius * tangent * sine;
        double y2 = y0 + y_offset;
        double y5 = (y0 + y10) / 2;
        double y8 = y10 - y_offset;

        double x3 = x0 + (y5 - y2) * tangent;
        double x7 = x10 - (y5 - y2) * tangent;
        double y4 = y5 - radius * tangent * cosine;
        double y6 = y5 + radius * tangent * cosine;

        double y_offset_angle = atan (y_offset / (x5 - x3));
        double y_offset_sine = sin (y_offset_angle);
        double y_offset_cosine = cos (y_offset_angle);

        double half_complement_angle = (G_PI / 2 - side_angle - y_offset_angle) / 2;
        double half_complement_cosine = cos (half_complement_angle);

        double dx = (radius * cos (side_angle + half_complement_angle)) / half_complement_cosine;
        double dy = (radius * sin (side_angle + half_complement_angle)) / half_complement_cosine;

        double x2 = x3 + dx - radius * cosine;
        double x4 = x3 + dx - radius * y_offset_sine;
        double x6 = x7 - dx + radius * y_offset_sine;
        double x8 = x7 - dx + radius * cosine;
        double y1 = y2 + dy - radius * y_offset_cosine;
        double y3 = y2 + dy - radius * sine;
        double y7 = y8 - dy + radius * sine;
        double y9 = y8 - dy + radius * y_offset_cosine;

        cairo_move_to (ctx->cr, x5, y10);
        arc_to (ctx->cr, x3, y8, x2, y7, radius);
        arc_to (ctx->cr, x0, y5, x1, y4, radius);
        arc_to (ctx->cr, x3, y2, x4, y1, radius);
        cairo_line_to (ctx->cr, x5, y0);
        arc_to (ctx->cr, x7, y2, x8, y3, radius);
        arc_to (ctx->cr, x10, y5, x9, y6, radius);
        arc_to (ctx->cr, x7, y8, x6, y9, radius);
        cairo_line_to (ctx->cr, x5, y10);
        cairo_close_path (ctx->cr);

        break;
      }

    case SHAPE_BRANSON:
      {
        /* Special case for Branson, Missouri color-coded routes */
        double x, y, w, h;

        /* Background rectangle */
        rounded_rect (ctx->cr, width, height, 2, 0.5);
        cairo_set_source_rgba (ctx->cr, 0, 0.404, 0.278, 1);
        cairo_fill_preserve (ctx->cr);
        cairo_set_source_rgba (ctx->cr, 1, 1, 1, 1);
        cairo_set_line_width (ctx->cr, 1);
        cairo_stroke (ctx->cr);

        /* Color rectangle */
        x = 0.15 * width + 0.5;
        w = 0.7 * width - 1;
        y = 0.4 * height + 0.5;
        h = 0.45 * height - 1;

        cairo_rectangle (ctx->cr, x, y, w, h);

        break;
      }
    }

  if (ctx->shield->shape_options.fill.alpha > 0)
    {
      gdk_cairo_set_source_rgba (ctx->cr, &ctx->shield->shape_options.fill);
      cairo_fill_preserve (ctx->cr);
    }

  if (ctx->shield->shape_options.outline.alpha > 0)
    {
      gdk_cairo_set_source_rgba (ctx->cr, &ctx->shield->shape_options.outline);
      cairo_set_line_width (ctx->cr, outline_width);
      cairo_stroke_preserve (ctx->cr);
    }

  cairo_new_path (ctx->cr);

  cairo_restore (ctx->cr);
}

static void
draw_shield_text (RenderCtx *ctx,
                  double width,
                  double height,
                  double banner_height)
{
  g_autoptr(PangoLayout) layout = NULL;
  PangoRectangle extent;
  double extent_x, extent_y;
  double x, y, font_size;

  layout_shield_text (ctx, width, height, &x, &y, &font_size, &layout);

  pango_layout_get_extents (layout, &extent, NULL);
  extent_x = extent.x / (double) PANGO_SCALE;
  extent_y = extent.y / (double) PANGO_SCALE;

  cairo_move_to (ctx->cr, x - extent_x, y + banner_height - extent_y);

  pango_cairo_layout_path (ctx->cr, layout);

  if (ctx->shield->text_halo_color_set)
    {
      gdk_cairo_set_source_rgba (ctx->cr, &ctx->shield->text_halo_color);
      cairo_set_line_width (ctx->cr, 2);
      cairo_stroke_preserve (ctx->cr);
    }

  if (ctx->shield->text_color_set)
    gdk_cairo_set_source_rgba (ctx->cr, &ctx->shield->text_color);
  else
    gdk_cairo_set_source_rgba (ctx->cr, &(GdkRGBA){0, 0, 0, 1});

  cairo_fill (ctx->cr);
}

static GdkTexture *
texture_new_for_surface (cairo_surface_t *surface)
{
  g_autoptr(GBytes) bytes = NULL;
  GdkTexture *texture;

  g_return_val_if_fail (cairo_surface_get_type (surface) == CAIRO_SURFACE_TYPE_IMAGE, NULL);
  g_return_val_if_fail (cairo_image_surface_get_width (surface) > 0, NULL);
  g_return_val_if_fail (cairo_image_surface_get_height (surface) > 0, NULL);

  bytes = g_bytes_new_with_free_func (cairo_image_surface_get_data (surface),
                                      (gsize) cairo_image_surface_get_height (surface)
                                      * (gsize) cairo_image_surface_get_stride (surface),
                                      (GDestroyNotify) cairo_surface_destroy,
                                      cairo_surface_reference (surface));

  texture = gdk_memory_texture_new (cairo_image_surface_get_width (surface),
                                    cairo_image_surface_get_height (surface),
                                    GDK_MEMORY_B8G8R8A8_PREMULTIPLIED,
                                    bytes,
                                    cairo_image_surface_get_stride (surface));

  return texture;
}

static guint32
blend_pixel (guchar src, float src_a, float lighten, float darken)
{
  return 255.0 - (src / src_a * (1 - darken)) - ((255 - src / src_a) * (1 - lighten));
}

static void
transpose_image_data (RenderCtx *ctx,
                      RsvgHandle *source_sprite,
                      double banner_height)
{
  cairo_surface_t *surface = cairo_get_target (ctx->cr);
  cairo_pattern_t *pattern;

  cairo_save (ctx->cr);

  cairo_translate (ctx->cr, 0, banner_height);

  pattern = create_pattern (source_sprite, ctx);
  cairo_set_source (ctx->cr, pattern);
  cairo_pattern_destroy (pattern);

  cairo_paint (ctx->cr);

  cairo_restore (ctx->cr);

  if (ctx->shield->color_darken_set || ctx->shield->color_lighten_set)
    {
      guchar *data;
      data = cairo_image_surface_get_data (surface);
      int width, height, stride;
      GdkRGBA color_darken, color_lighten;

      cairo_surface_flush (surface);

      stride = cairo_image_surface_get_stride (surface);
      width = cairo_image_surface_get_width (surface);
      height = cairo_image_surface_get_height (surface);

      if (ctx->shield->color_darken_set)
        color_darken = ctx->shield->color_darken;
      else
        color_darken = (GdkRGBA){ 1, 1, 1, 1 };

      if (ctx->shield->color_lighten_set)
        color_lighten = ctx->shield->color_lighten;
      else
        color_lighten = (GdkRGBA){ 0, 0, 0, 1 };

      for (int x = 0; x < width; x ++)
        {
          for (int y = 0; y < height; y ++)
            {
              guint32 *pixel = (guint32 *)(data + y * stride + x * 4);
              float src_a = (*pixel >> 24 & 0xff) / 255.0;
              if (src_a == 0)
                continue;
              *pixel =
                (*pixel & 0xff000000)
                | ((blend_pixel (*pixel >> 16 & 0xff, src_a, color_lighten.red, color_darken.red) << 16) & 0xff0000)
                | ((blend_pixel (*pixel >> 8 & 0xff, src_a, color_lighten.green, color_darken.green) << 8) & 0xff00)
                | (blend_pixel (*pixel & 0xff, src_a, color_lighten.blue, color_darken.blue) & 0xff);
            }
        }

      cairo_surface_mark_dirty (surface);
    }
}

static gboolean
is_valid_ref (const char *ref)
{
  int len = ref == NULL ? 0 : strlen (ref);
  return len > 0 && len <= 6;
}

/**
 * maps_shield_draw:
 * @self: a [class@Shield]
 * @ref: the highway reference
 * @name: the highway name
 * @color: the route color
 * @scale: the scale factor
 *
 * Returns: (transfer full): a [class@Shumate.VectorSprite]
 */
ShumateVectorSprite *
maps_shield_draw (MapsShield *self,
                  const char *ref,
                  const char *name,
                  const char *color,
                  double scale)
{
  RenderCtx ctx;
  RsvgHandle *source_sprite = NULL;
  double width = SHIELD_SIZE, height = SHIELD_SIZE;
  double banner_height;
  cairo_surface_t *surface;
  g_autoptr(GdkTexture) texture = NULL;

  g_return_val_if_fail (MAPS_IS_SHIELD (self), NULL);

  ctx = (RenderCtx){
    .shield = g_object_ref (self),
    .ref = ref,
    .name = name,
    .scale = scale,
  };

  if (self->ref_by_name != NULL && name != NULL)
    {
      const char *ref_override = g_hash_table_lookup (self->ref_by_name, name);
      if (ref_override != NULL)
        ctx.ref = ref_override;
    }

  if (self->override_by_ref != NULL && ctx.ref != NULL)
    {
      MapsShield *override = g_hash_table_lookup (self->override_by_ref, ctx.ref);
      if (override != NULL)
        g_set_object (&ctx.shield, apply_override (self, override));
    }

  if (self->override_by_name != NULL && ctx.name != NULL)
    {
      MapsShield *override = g_hash_table_lookup (self->override_by_name, ctx.name);
      if (override != NULL)
        g_set_object (&ctx.shield, apply_override (self, override));
    }

  if (!is_valid_ref (ref))
    {
      if (self->override_noref != NULL)
        g_set_object (&ctx.shield, apply_override (self, self->override_noref));
      else if (!ctx.shield->notext && !ctx.shield->ref && !(self->override_by_name != NULL && ctx.name != NULL))
        return NULL;
    }

  if (ctx.shield->ref)
    ctx.ref = ctx.shield->ref;

  if (ctx.shield->notext)
    ctx.ref = NULL;

  source_sprite = get_raster_shield_blank (&ctx);

  if (source_sprite == NULL)
    {
      if (ctx.shield->shape_options.shape != SHAPE_UNSET)
        get_drawn_shield_bounds (&ctx, &width, &height);
    }
  else
    {
      rsvg_handle_get_intrinsic_size_in_pixels (source_sprite, &width, &height);
    }

  banner_height = BANNER_HEIGHT * (self->banners == NULL ? 0 : g_strv_length (self->banners));
  height += banner_height;

  surface = cairo_image_surface_create (CAIRO_FORMAT_ARGB32, width * scale, height * scale);
  ctx.cr = cairo_create (surface);
  cairo_scale (ctx.cr, scale, scale);

  if (ctx.shield->romanize_ref && is_valid_ref (ctx.ref))
    ctx.ref = romanize_ref (ctx.ref);

  draw_banners (&ctx, width);

  if (source_sprite == NULL)
    draw_shield (&ctx, width, height - banner_height, banner_height);
  else
    transpose_image_data (&ctx, source_sprite, banner_height);

  g_clear_object (&source_sprite);

  if (!ctx.shield->notext && is_valid_ref (ctx.ref))
    draw_shield_text (&ctx, width, height - banner_height, banner_height);

  g_object_unref (ctx.shield);
  if (ctx.shield->romanize_ref)
    g_free ((char *)ctx.ref);

  cairo_destroy (ctx.cr);

  texture = texture_new_for_surface (surface);
  cairo_surface_destroy (surface);
  return shumate_vector_sprite_new_full (
    GDK_PAINTABLE (texture),
    width,
    height,
    scale,
    NULL
  );
}
