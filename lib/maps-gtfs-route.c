/*
 * Copyright (c) 2020 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

#include "maps-gtfs-route.h"

struct _MapsGTFSRoute
{
  GObject parent_instance;
};

typedef struct
{
  gchar *id;
  gchar *agency_id;
  gchar *short_name;
  gchar *long_name;
  guint16 type;
  gchar *color;
  gchar *text_color;
} MapsGTFSRoutePrivate;

G_DEFINE_TYPE_WITH_PRIVATE (MapsGTFSRoute, maps_gtfs_route, G_TYPE_OBJECT)

enum {
  PROP_0,
  PROP_ID,
  PROP_AGENCY_ID,
  PROP_SHORT_NAME,
  PROP_LONG_NAME,
  PROP_TYPE,
  PROP_COLOR,
  PROP_TEXT_COLOR,
  N_PROPS
};

static GParamSpec *properties [N_PROPS];

/**
 * maps_gtfs_route_new:
 *
 * Create a new #MapsGTFSRoute.
 *
 * Returns: (transfer full): a newly created #MapsGTFSRoute
 */
MapsGTFSRoute *
maps_gtfs_route_new (gchar *id, gchar *agency_id, gchar *short_name,
                     gchar *long_name, guint16 type, gchar *color, gchar *text_color)
{
  MapsGTFSRoute *route =
    MAPS_GTFS_ROUTE (g_object_new (MAPS_TYPE_GTFS_ROUTE,
                                   "id", id,
                                   "agency_id", agency_id,
                                   "short_name", short_name,
                                   "long_name", long_name,
                                   "type", type,
                                   "color", color,
                                   "text_color", text_color, NULL));

  return route;
}

static void
maps_gtfs_route_finalize (GObject *object)
{
  MapsGTFSRoute *self = (MapsGTFSRoute *)object;
  MapsGTFSRoutePrivate *priv = maps_gtfs_route_get_instance_private (self);

  g_clear_pointer (&priv->id, g_free);
  g_clear_pointer (&priv->agency_id, g_free);
  g_clear_pointer (&priv->short_name, g_free);
  g_clear_pointer (&priv->long_name, g_free);
  g_clear_pointer (&priv->color, g_free);
  g_clear_pointer (&priv->text_color, g_free);

  G_OBJECT_CLASS (maps_gtfs_route_parent_class)->finalize (object);
}

static void
maps_gtfs_route_get_property (GObject    *object,
                              guint       prop_id,
                              GValue     *value,
                              GParamSpec *pspec)
{
  MapsGTFSRoute *self = MAPS_GTFS_ROUTE (object);
  MapsGTFSRoutePrivate *priv = maps_gtfs_route_get_instance_private (self);

  switch (prop_id)
    {
    case PROP_ID:
      g_value_set_string (value, priv->id);
      break;
    case PROP_AGENCY_ID:
      g_value_set_string (value, priv->agency_id);
      break;
    case PROP_SHORT_NAME:
      g_value_set_string (value, priv->short_name);
      break;
    case PROP_LONG_NAME:
      g_value_set_string (value, priv->long_name);
    case PROP_TYPE:
      g_value_set_uint (value, (guint) priv->type);
      break;
    case PROP_COLOR:
      g_value_set_string (value, priv->color);
      break;
    case PROP_TEXT_COLOR:
      g_value_set_string (value, priv->text_color);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_gtfs_route_set_property (GObject    *object,
                              guint       prop_id,
                              GValue     *value,
                              GParamSpec *pspec)
{
  MapsGTFSRoute *self = MAPS_GTFS_ROUTE (object);
  MapsGTFSRoutePrivate *priv = maps_gtfs_route_get_instance_private (self);

  switch (prop_id)
    {
    case PROP_ID:
      priv->id = g_value_dup_string (value);
      break;
    case PROP_AGENCY_ID:
      priv->agency_id = g_value_dup_string (value);
      break;
    case PROP_SHORT_NAME:
      priv->short_name = g_value_dup_string (value);
      break;
    case PROP_LONG_NAME:
      priv->long_name = g_value_dup_string (value);
    case PROP_TYPE:
      priv->type = g_value_get_uint (value);
      break;
    case PROP_COLOR:
      priv->color = g_value_dup_string (value);
      break;
    case PROP_TEXT_COLOR:
      priv->text_color = g_value_dup_string (value);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_gtfs_route_class_init (MapsGTFSRouteClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->finalize = maps_gtfs_route_finalize;
  object_class->get_property = maps_gtfs_route_get_property;
  object_class->set_property = maps_gtfs_route_set_property;

  properties[PROP_ID] =
    g_param_spec_string ("id",
                         "ID", "Unique identifier for stop",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_AGENCY_ID] =
    g_param_spec_string ("agency_id",
                         "Agency ID", "Reference to agency ID",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_SHORT_NAME] =
    g_param_spec_string ("short_name",
                         "Short name", "Short name, like 32, 100X, or Green",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_LONG_NAME] =
    g_param_spec_string ("long_name",
                         "Long name", "Long name",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_TYPE] =
    g_param_spec_uint ("type",
                       "Type", "Route type, GTFS or HVT route type code",
                       0, 65535, 0,
                       G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_COLOR] =
    g_param_spec_string ("color",
                         "Color", "Color for the route",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_TEXT_COLOR] =
    g_param_spec_string ("text_color",
                         "Text color", "Text color for the route",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);

  g_object_class_install_properties (object_class, N_PROPS, properties);
}

static void
maps_gtfs_route_init (MapsGTFSRoute *self)
{
  MapsGTFSRoutePrivate *priv = maps_gtfs_route_get_instance_private (self);

  priv->id = NULL;
  priv->agency_id = NULL;
  priv->short_name = NULL;
  priv->long_name = NULL;
  priv->type = 0;
  priv->color = NULL;
  priv->text_color = NULL;
}
