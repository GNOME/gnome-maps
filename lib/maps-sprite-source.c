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

#include <json-glib/json-glib.h>

#include "maps-sprite-source.h"

struct _MapsSpriteSource {
  GObject parent_instance;

  char *color_scheme;

  GtkTextDirection text_direction;

  GHashTable *shields;
  GRegex *shield_regex;
};

enum {
  PROP_0,
  PROP_COLOR_SCHEME,
  N_PROPERTIES
};

static GParamSpec *properties[N_PROPERTIES];

G_DEFINE_TYPE (MapsSpriteSource, maps_sprite_source, G_TYPE_OBJECT)

MapsSpriteSource *
maps_sprite_source_new (const char *color_scheme)
{
  return g_object_new (MAPS_TYPE_SPRITE_SOURCE,
                       "color-scheme", color_scheme,
                       NULL);
}

static void
maps_sprite_source_finalize (GObject *object)
{
  MapsSpriteSource *self = MAPS_SPRITE_SOURCE (object);

  g_clear_pointer (&self->color_scheme, g_free);
  g_clear_pointer (&self->shields, g_hash_table_unref);
  g_clear_pointer (&self->shield_regex, g_regex_unref);

  G_OBJECT_CLASS (maps_sprite_source_parent_class)->finalize (object);
}

static void
maps_sprite_source_get_property (GObject *object,
                                 guint prop_id,
                                 GValue *value,
                                 GParamSpec *pspec)
{
  MapsSpriteSource *self = MAPS_SPRITE_SOURCE (object);

  switch (prop_id)
    {
    case PROP_COLOR_SCHEME:
      g_value_set_string (value, self->color_scheme);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_sprite_source_set_property (GObject *object,
                                 guint prop_id,
                                 const GValue *value,
                                 GParamSpec *pspec)
{
  MapsSpriteSource *self = MAPS_SPRITE_SOURCE (object);

  switch (prop_id)
    {
    case PROP_COLOR_SCHEME:
      g_clear_pointer (&self->color_scheme, g_free);
      self->color_scheme = g_value_dup_string (value);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_sprite_source_class_init (MapsSpriteSourceClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->finalize = maps_sprite_source_finalize;
  object_class->get_property = maps_sprite_source_get_property;
  object_class->set_property = maps_sprite_source_set_property;

  properties[PROP_COLOR_SCHEME] =
    g_param_spec_string ("color-scheme",
                         "color-scheme",
                         "color-scheme",
                         NULL,
                         G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS);

  g_object_class_install_properties (object_class, N_PROPERTIES, properties);
}

static void
maps_sprite_source_init (MapsSpriteSource *self)
{
  self->shields = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_object_unref);
  self->shield_regex = g_regex_new ("shield\n(.*)\n(.*)=(.*)(?:\n(.*))?", G_REGEX_MULTILINE, 0, NULL);
  self->text_direction = gtk_widget_get_default_direction ();
}

static ShumateVectorSprite *
fallback_function (ShumateVectorSpriteSheet *sprite_sheet,
                   const char               *name,
                   double                    scale,
                   gpointer                  user_data)
{
  MapsSpriteSource *self = user_data;
  GtkIconTheme *icon_theme;
  g_autoptr(GtkIconPaintable) paintable = NULL;

  if (strlen (name) == 0)
    return NULL;

  if (g_str_has_prefix (name, "shield\n"))
    {
      g_auto(GStrv) lines = NULL;
      char *highway_class = NULL;
      char *network = NULL;
      char *ref = NULL;
      char *shield_name = NULL;
      char *color = NULL;
      MapsShield *shield;

      lines = g_strsplit (name, "\n", -1);

      if (g_strv_length (lines) < 6)
        return NULL;

      highway_class = lines[1];
      network = lines[2];
      ref = lines[3];
      shield_name = lines[4];
      color = lines[5];

      if (strlen (ref) == 0)
        ref = NULL;

      /* filter out recreational routes--see <https://github.com/ZeLonewolf/openstreetmap-americana/blob/main/src/js/shield_format.ts> */
      if (g_regex_match_simple ("^[lrni][chimpw]n$", network, 0, 0))
        return NULL;

      shield = g_hash_table_lookup (self->shields, network);
      if (shield == NULL)
        {
          g_autofree char *def = g_strdup_printf ("default-%s-%s", highway_class, self->color_scheme);
          shield = g_hash_table_lookup (self->shields, def);
          if (shield == NULL)
            return NULL;
        }

      return maps_shield_draw (shield, ref, shield_name, color, scale);
    }
  else
    {
      icon_theme = gtk_icon_theme_get_for_display (gdk_display_get_default ());

      paintable = gtk_icon_theme_lookup_icon (
        icon_theme,
        name,
        NULL,
        16,
        scale,
        self->text_direction,
        0
      );

      if (paintable == NULL)
        return NULL;

      return shumate_vector_sprite_new (GDK_PAINTABLE (paintable));
    }
}

/**
 * maps_sprite_source_set_fallback:
 * @self: a [class@SpriteSource]
 * @sprite_sheet: a [class@Shumate.VectorSpriteSheet]
 *
 * Sets the sprite sheet's fallback function.
 */
void
maps_sprite_source_set_fallback (MapsSpriteSource *self,
                                 ShumateVectorSpriteSheet *sprite_sheet)
{
  g_return_if_fail (MAPS_IS_SPRITE_SOURCE (self));
  g_return_if_fail (SHUMATE_IS_VECTOR_SPRITE_SHEET (sprite_sheet));

  shumate_vector_sprite_sheet_set_fallback (sprite_sheet, fallback_function, g_object_ref (self), g_object_unref);
}

/**
 * maps_sprite_source_load_shield_defs:
 * @self: a [class@SpriteSource]
 * @json: a JSON string
 *
 * Loads shield definitions from a JSON string.
 */
void
maps_sprite_source_load_shield_defs (MapsSpriteSource *self, const char *json)
{
  g_autoptr(JsonNode) root = NULL;
  JsonObject *root_obj;
  JsonObjectIter iter;
  JsonObject *networks;
  const char *network_name;
  JsonNode *network_node;

  g_return_if_fail (MAPS_IS_SPRITE_SOURCE (self));

  root = json_from_string (json, NULL);
  root_obj = json_node_get_object (root);

  networks = json_object_get_object_member (root_obj, "networks");
  json_object_iter_init (&iter, networks);
  while (json_object_iter_next (&iter, &network_name, &network_node))
    {
      JsonObject *network;

      g_hash_table_insert (self->shields, g_strdup (network_name), maps_shield_new (network_node));
      network = json_node_get_object (network_node);

      if (json_object_has_member (network, "bannerMap"))
        {
          JsonObject *banner_map;
          JsonObjectIter banner_iter;
          JsonNode *banners;
          const char *banner_network_name;

          banner_map = json_object_get_object_member (network, "bannerMap");
          json_object_iter_init (&banner_iter, banner_map);
          while (json_object_iter_next (&banner_iter, &banner_network_name, &banners))
            {
              if (JSON_NODE_HOLDS_ARRAY (banners))
                {
                  g_hash_table_insert (self->shields,
                                       g_strdup (banner_network_name),
                                       maps_shield_new_with_banners (network_node,
                                                                     json_node_get_array (banners)));
                }
            }
        }
    }
}

/**
 * maps_sprite_source_get_shield_for_network:
 * @self: a [class@MapsSpriteSource]
 * @network_name: network name
 * @returns: (transfer none): a [class@MapsShield]
 */
MapsShield *
maps_sprite_source_get_shield_for_network (MapsSpriteSource *self,
                                           const char *network_name)
{
  return g_hash_table_lookup (self->shields, network_name);
}
