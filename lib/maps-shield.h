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

#pragma once

#include <shumate/shumate.h>

G_BEGIN_DECLS

#define MAPS_TYPE_SHIELD (maps_shield_get_type())
G_DECLARE_FINAL_TYPE (MapsShield, maps_shield, MAPS, SHIELD, GObject)

MapsShield *maps_shield_new (JsonNode *node);

MapsShield *maps_shield_new_with_banners (JsonNode *node, JsonArray *banners);

ShumateVectorSprite *maps_shield_draw (MapsShield *self,
                                       const char *ref,
                                       const char *name,
                                       const char *color,
                                       double scale);

G_END_DECLS
