/*
 * Copyright (c) 2023 James Westman
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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>
 *
 * Author: James Westman <james@jwestman.net>
 */

#include "maps-sprite-source.h"

struct _MapsSpriteSource {
  GObject parent_instance;
};

G_DEFINE_TYPE (MapsSpriteSource, maps_sprite_source, G_TYPE_OBJECT)

MapsSpriteSource *
maps_sprite_source_new (void)
{
  return g_object_new (MAPS_TYPE_SPRITE_SOURCE, NULL);
}

static void
maps_sprite_source_class_init (MapsSpriteSourceClass *klass)
{
}

static void
maps_sprite_source_init (MapsSpriteSource *self)
{

}

static ShumateVectorSprite *
fallback_function (ShumateVectorSpriteSheet *sprite_sheet,
                   const char               *name,
                   double                    scale,
                   gpointer                  user_data)
{
  GtkIconTheme *icon_theme;
  g_autoptr(GtkIconPaintable) paintable = NULL;

  if (strlen (name) == 0)
    return NULL;

  if (!g_str_has_suffix (name, "-symbolic"))
    return NULL;

  icon_theme = gtk_icon_theme_get_for_display (gdk_display_get_default ());

  paintable = gtk_icon_theme_lookup_icon (
    icon_theme,
    name,
    NULL,
    16,
    scale,
    GTK_TEXT_DIR_NONE,
    0
  );

  if (paintable == NULL)
    return NULL;

  return shumate_vector_sprite_new (GDK_PAINTABLE (paintable));
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
