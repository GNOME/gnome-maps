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

#include "maps-gtfs-agency.h"

typedef struct
{
  gchar *id;
  gchar *name;
  gchar *url;
  GTimeZone *timezone;
  gchar *lang;
  gchar *phone;
  gchar *fare_url;
  gchar *email;
} MapsGTFSAgencyPrivate;

G_DEFINE_TYPE_WITH_PRIVATE (MapsGTFSAgency, maps_gtfs_agency, G_TYPE_OBJECT)

enum {
  PROP_0,
  PROP_ID,
  PROP_NAME,
  PROP_URL,
  PROP_TIMEZONE,
  PROP_LANG,
  PROP_PHONE,
  PROP_FARE_URL,
  PROP_EMAIL,
  N_PROPS
};

static GParamSpec *properties [N_PROPS];

/**
 * maps_gtfs_agency_new:
 *
 * Create a new #MapsGtfsAgency.
 *
 * Returns: (transfer full): a newly created #MapsGtfsAgency
 */
MapsGTFSAgency *
maps_gtfs_agency_new (gchar *id, gchar *name, gchar *url, GTimeZone *timezone,
                      gchar *lang, gchar *phone, gchar *fare_url, gchar *email)
{
  MapsGTFSAgency *agency =
    MAPS_GTFS_AGENCY (g_object_new (MAPS_TYPE_GTFS_AGENCY, NULL));
  MapsGTFSAgencyPrivate *priv = maps_gtfs_agency_get_instance_private (agency);

  priv->id = g_strdup (id);
  priv->name = g_strdup (name);
  priv->url = g_strdup (url);
  priv->timezone = g_time_zone_ref (timezone);
  priv->lang = g_strdup (lang);
  priv->phone = g_strdup (phone);
  priv->fare_url = g_strdup (fare_url);
  priv->email = g_strdup (email);

  return agency;
}

static void
maps_gtfs_agency_finalize (GObject *object)
{
  MapsGTFSAgency *self = (MapsGTFSAgency *)object;
  MapsGTFSAgencyPrivate *priv = maps_gtfs_agency_get_instance_private (self);

  g_clear_pointer (&priv->id, g_free);
  g_clear_pointer (&priv->name, g_free);
  g_clear_pointer (&priv->url, g_free);
  g_clear_pointer (&priv->timezone, g_free);
  g_clear_pointer (&priv->lang, g_free);
  g_clear_pointer (&priv->phone, g_free);
  g_clear_pointer (&priv->fare_url, g_free);
  g_clear_pointer (&priv->email, g_free);

  G_OBJECT_CLASS (maps_gtfs_agency_parent_class)->finalize (object);
}

static void
maps_gtfs_agency_get_property (GObject    *object,
                               guint       prop_id,
                               GValue     *value,
                               GParamSpec *pspec)
{
  MapsGTFSAgency *self = MAPS_GTFS_AGENCY (object);
  MapsGTFSAgencyPrivate *priv = maps_gtfs_agency_get_instance_private (self);

  switch (prop_id)
    {
    case PROP_ID:
      g_value_set_string (value, priv->id);
      break;
    case PROP_NAME:
      g_value_set_string (value, priv->name);
      break;
    case PROP_URL:
      g_value_set_string (value, priv->url);
      break;
    case PROP_TIMEZONE:
      g_value_set_boxed (value, priv->timezone);
      break;
    case PROP_LANG:
      g_value_set_string (value, priv->lang);
      break;
    case PROP_PHONE:
      g_value_set_string (value, priv->phone);
      break;
    case PROP_FARE_URL:
      g_value_set_string (value, priv->fare_url);
      break;
    case PROP_EMAIL:
      g_value_set_string (value, priv->email);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_gtfs_agency_class_init (MapsGTFSAgencyClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->finalize = maps_gtfs_agency_finalize;
  object_class->get_property = maps_gtfs_agency_get_property;

  properties[PROP_ID] =
    g_param_spec_string ("id",
                         "ID", "Unique identifier for agency",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_NAME] =
    g_param_spec_string ("name",
                         "Name", "Name of agency",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_URL] =
    g_param_spec_string ("url",
                         "URL", "URL of agency web page",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_TIMEZONE] =
    g_param_spec_boxed ("timezone",
                        "Timezone", "Local timezone agency operates in",
                        G_TYPE_TIME_ZONE,
                        G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_LANG] =
    g_param_spec_string ("lang",
                         "Language",
                         "ISO language code for the native language, e.g. 'en', 'pt-BR'",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_PHONE] =
    g_param_spec_string ("phone",
                         "Phone", "Phone number to agency",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_FARE_URL] =
    g_param_spec_string ("fare_url",
                         "Fare URL", "URL of agency's fare information web page",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_EMAIL] =
    g_param_spec_string ("email",
                         "E-mail", "E-mail address to agency",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);

  g_object_class_install_properties (object_class, N_PROPS, properties);
}

static void
maps_gtfs_agency_init (MapsGTFSAgency *self)
{
  MapsGTFSAgencyPrivate *priv = maps_gtfs_agency_get_instance_private (self);

  priv->id = NULL;
  priv->name = NULL;
  priv->url = NULL;
  priv->timezone = NULL;
  priv->lang = NULL;
  priv->phone = NULL;
  priv->fare_url = NULL;
  priv->email = NULL;
}
