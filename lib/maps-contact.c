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

#include <folks/folks.h>
#include <geocode-glib/geocode-glib.h>

#include "maps-contact.h"

struct _MapsContactPrivate
{
  char *name;
  char *id;

  GLoadableIcon *icon;
  GList *places;

  GMutex geocode_mutex;
  guint geocode_counter;
  guint geocodes_to_perform;
};

typedef struct
{
  GeocodePlace *place;
  MapsContact *contact;
  MapsContactGeocodeCallback callback;

  GHashTable *params;
} GeocodeData;

enum {
  PROP_0,

  PROP_NAME,
  PROP_ICON,
  PROP_ID,
  PROP_BBOX
};

G_DEFINE_TYPE_WITH_PRIVATE (MapsContact, maps_contact, G_TYPE_OBJECT)

static void
maps_contact_set_property (GObject      *object,
                           guint         property_id,
                           const GValue *value,
                           GParamSpec   *pspec)
{
  MapsContact *contact = MAPS_CONTACT (object);

  switch (property_id)
    {
    case PROP_NAME:
      g_free (contact->priv->name);
      contact->priv->name = g_value_dup_string (value);
      break;

    case PROP_ICON:
      if (contact->priv->icon)
        g_object_unref (contact->priv->icon);
      contact->priv->icon = g_value_dup_object (value);
      break;

    case PROP_ID:
      g_free (contact->priv->id);
      contact->priv->id = g_value_dup_string (value);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
      break;
    }
}

static void
maps_contact_get_property (GObject    *object,
                           guint       property_id,
                           GValue     *value,
                           GParamSpec *pspec)
{
  MapsContact *contact = MAPS_CONTACT (object);

  switch (property_id)
    {
    case PROP_NAME:
      g_value_set_string (value,
                          contact->priv->name);
      break;

    case PROP_ICON:
      g_value_set_object (value,
                          contact->priv->icon);
      break;

    case PROP_ID:
      g_value_set_string (value,
                          contact->priv->id);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
      break;
    }
}

static void
maps_contact_dispose (GObject *object)
{
  MapsContact *contact = (MapsContact *) object;

  g_clear_pointer (&contact->priv->name, g_free);
  g_clear_pointer (&contact->priv->id, g_free);
  g_clear_object (&contact->priv->icon);
  g_list_free_full (contact->priv->places, g_object_unref);

  G_OBJECT_CLASS (maps_contact_parent_class)->dispose (object);
}

static void
maps_contact_class_init (MapsContactClass *klass)
{
  GObjectClass *maps_class = G_OBJECT_CLASS (klass);
  GParamSpec *pspec;

  maps_class->dispose = maps_contact_dispose;
  maps_class->get_property = maps_contact_get_property;
  maps_class->set_property = maps_contact_set_property;

  /**
   * MapsContact:name:
   *
   * The name of the contact.
   */
  pspec = g_param_spec_string ("name",
                               "Name",
                               "Name",
                               NULL,
                               G_PARAM_READWRITE |
                               G_PARAM_STATIC_STRINGS);
  g_object_class_install_property (maps_class, PROP_NAME, pspec);

  /**
   * MapsContact:id:
   *
   * The unique id of the contact.
   */
  pspec = g_param_spec_string ("id",
                               "ID",
                               "ID",
                               NULL,
                               G_PARAM_READWRITE |
                               G_PARAM_STATIC_STRINGS);
  g_object_class_install_property (maps_class, PROP_ID, pspec);

  /**
   * MapsContact:icon:
   *
   * The icon of the contact.
   */
  pspec = g_param_spec_object ("icon",
                               "Icon",
                               "An icon representing the contact",
                               G_TYPE_ICON,
                               G_PARAM_READWRITE |
                               G_PARAM_STATIC_STRINGS);
  g_object_class_install_property (maps_class, PROP_ICON, pspec);
}

static void
maps_contact_init (MapsContact *contact)
{
  contact->priv = maps_contact_get_instance_private (contact);

  contact->priv->name = NULL;
  contact->priv->id = NULL;
  contact->priv->icon = NULL;
  contact->priv->places = NULL;

  g_mutex_init (&contact->priv->geocode_mutex);
}

/**
 * maps_contact_add_address:
 * @contact: A #MapsContact object
 * @place: A #GeocodePlace object
 */
void
maps_contact_add_place (MapsContact  *contact,
                        GeocodePlace *place)
{
  g_return_if_fail (MAPS_IS_CONTACT (contact));
  g_return_if_fail (GEOCODE_IS_PLACE (place));

  contact->priv->places = g_list_prepend (contact->priv->places, place);
}

/**
 * maps_contact_get_places:
 * @contact: A #MapsContact object
 *
 * Returns: (element-type GeocodePlace) (transfer container): a list of #GeocodePlace
 */
GList *
maps_contact_get_places (MapsContact *contact)
{
  g_return_val_if_fail (MAPS_IS_CONTACT (contact), NULL);

  return contact->priv->places;
}

static void
on_geocode_search_async (GeocodeForward *forward,
                         GAsyncResult   *res,
                         GeocodeData    *data)
{
  MapsContact *contact;
  GList *places;
  gboolean call_callback = FALSE;

  contact = data->contact;
  places = geocode_forward_search_finish (forward, res, NULL);

  g_mutex_lock (&contact->priv->geocode_mutex);

  if (places)
    {
      GeocodePlace *place = g_list_nth_data (places, 0);
      GeocodeLocation *location = geocode_place_get_location (place);
      const char *street_address;
      const char *street;

      /* Keep the naming, but add location and osm info */
      geocode_place_set_location (data->place, location);
      g_object_set (G_OBJECT (data->place), "osm-type",
                    geocode_place_get_osm_type (place), NULL);
      g_object_set (G_OBJECT (data->place), "osm-id",
                    geocode_place_get_osm_id (place), NULL);

      /* Make sure we do not lie about how good our resolution is */
      street_address = geocode_place_get_street_address (place);
      street = geocode_place_get_street (place);
      if (street_address)
        geocode_place_set_street_address (data->place, street);
      else if (street)
        geocode_place_set_street (data->place, street);

      g_list_free_full(places, g_object_unref);
    }

  contact->priv->geocode_counter++;
  if (contact->priv->geocode_counter == contact->priv->geocodes_to_perform)
    call_callback = TRUE;

  g_mutex_unlock (&contact->priv->geocode_mutex);

  g_hash_table_destroy (data->params);

  if (call_callback)
    data->callback (contact);
}

static void add_attribute (GHashTable *ht,
                           const char *key,
                           const char *s)
{
  GValue *value;
  value = g_new0 (GValue, 1);
  g_value_init (value, G_TYPE_STRING);
  g_value_set_static_string (value, s);
  g_hash_table_insert (ht, g_strdup (key), value);
}

/**
 * maps_contact_geocode:
 * @contact: A #MapsContact object
 * @callback: (scope async): A #MapsContactGeocodeCallback function
 */
void
maps_contact_geocode (MapsContact                *contact,
                      MapsContactGeocodeCallback callback)
{
  g_return_if_fail (MAPS_IS_CONTACT (contact));
  g_return_if_fail (callback != NULL);

  GList *l;

  contact->priv->geocode_counter = 0;
  contact->priv->geocodes_to_perform = g_list_length (contact->priv->places);

  for (l = contact->priv->places; l != NULL; l = l->next) {
    GeocodeData *data;
    GeocodeForward *forward;

    data = g_slice_new (GeocodeData);
    data->contact = contact;
    data->place = l->data;
    data->callback = callback;
    data->params = g_hash_table_new_full (g_str_hash,
                                          g_str_equal,
                                          g_free,
                                          g_free);

    add_attribute (data->params, "street",
                   geocode_place_get_street_address (data->place));
    add_attribute (data->params, "locality",
                   geocode_place_get_town (data->place));
    add_attribute (data->params, "region",
                   geocode_place_get_state (data->place));
    add_attribute (data->params, "country",
                   geocode_place_get_country (data->place));

    forward = geocode_forward_new_for_params (data->params);
    geocode_forward_search_async (forward,
                                  NULL,
                                  (GAsyncReadyCallback) on_geocode_search_async,
                                  data);
  }
}

MapsContact *
maps_contact_new ()
{
  return g_object_new (MAPS_TYPE_CONTACT, NULL);
}
