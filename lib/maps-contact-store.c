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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */


#include <folks/folks.h>
#include <geocode-glib/geocode-glib.h>

#include "maps-contact-store.h"
#include "maps-contact.h"
#include "maps-enum-types.h"

struct _MapsContactStorePrivate
{
  GList *list;
  MapsContactStoreState state;
  FolksIndividualAggregator *aggregator;
};

enum {
  PROP_0,

  PROP_STATE
};

G_DEFINE_TYPE_WITH_PRIVATE (MapsContactStore, maps_contact_store, G_TYPE_OBJECT)

static void
maps_contact_store_get_property (GObject    *object,
                                 guint       property_id,
                                 GValue     *value,
                                 GParamSpec *pspec)
{
  MapsContactStore *store = MAPS_CONTACT_STORE (object);

  switch (property_id)
    {
    case PROP_STATE:
      g_value_set_enum (value,
                        store->priv->state);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
      break;
    }
}

static void
maps_contact_store_dispose (GObject *object)
{
  MapsContactStore *store = (MapsContactStore *) object;

  g_list_free (store->priv->list);
  g_object_unref (store->priv->aggregator);

  G_OBJECT_CLASS (maps_contact_store_parent_class)->dispose (object);
}

static void
maps_contact_store_class_init (MapsContactStoreClass *klass)
{
  GObjectClass *maps_class = G_OBJECT_CLASS (klass);
  GParamSpec *pspec;

  maps_class->dispose = maps_contact_store_dispose;
  maps_class->get_property = maps_contact_store_get_property;

  /**
   * MapsContactStore:state:
   *
   * The type of the contact.
   */
  pspec = g_param_spec_enum ("state",
                             "State",
                             "State",
                             MAPS_TYPE_CONTACT_STORE_STATE,
                             MAPS_CONTACT_STORE_STATE_INITIAL,
                             G_PARAM_READABLE |
                             G_PARAM_STATIC_STRINGS);
  g_object_class_install_property (maps_class, PROP_STATE, pspec);
}

static void
maps_contact_store_init (MapsContactStore *store)
{
  store->priv = maps_contact_store_get_instance_private (store);
  store->priv->list = NULL;
  store->priv->state = MAPS_CONTACT_STORE_STATE_INITIAL;
}

static MapsContact *
get_contact (FolksIndividual *individual)
{
  MapsContact *contact;
  GLoadableIcon *avatar;
  GeeCollection *addresses;
  GeeIterator *iter;

  g_object_get (G_OBJECT (individual), "postal-addresses",
                &addresses, NULL);
  if (!addresses)
    return NULL;

  iter = gee_iterable_iterator (GEE_ITERABLE (addresses));
  if (!gee_iterator_has_next (iter))
    return NULL;

  contact = maps_contact_new ();

  g_object_set (G_OBJECT (contact), "name",
                folks_individual_get_display_name (individual));
  g_object_set (G_OBJECT (contact), "id",
                folks_individual_get_id (individual));

  g_object_get (G_OBJECT (individual), "avatar",
                &avatar);
  g_object_set (G_OBJECT (contact), "icon",
                avatar);

  while (gee_iterator_has_next (iter))
    {
      GeocodePlace *place;
      FolksPostalAddress *addr;
      FolksAbstractFieldDetails *details;
      GeeMultiMap *map;
      GeeSet *keys;
      GeeIterator *keys_iter;
      char *name;
      char *type = "Unknown";

      gee_iterator_next (iter);
      details = gee_iterator_get (iter);
      addr = (FolksPostalAddress *) folks_abstract_field_details_get_value (details);

      /* Get the type of the address, such as "Home", "Work", "Other" */
      map = folks_abstract_field_details_get_parameters (details);
      keys = gee_multi_map_get_keys (map);
      keys_iter = gee_iterable_iterator (GEE_ITERABLE (keys));
      if (gee_iterator_has_next (keys_iter))
        {
          GeeCollection *values;
          GeeIterator *values_iter;

          gee_iterator_next (keys_iter);
          values = gee_multi_map_get (map,
                                      gee_iterator_get (keys_iter));
          if (gee_collection_get_size (values) != 0)
            {
              values_iter = gee_iterable_iterator (GEE_ITERABLE (values));
              gee_iterator_next (values_iter);
              type = gee_iterator_get (values_iter);
            }
        }
      name = g_strdup_printf ("%s (%s)",
                              folks_individual_get_display_name (individual),
                              type);
      place = geocode_place_new (name, GEOCODE_PLACE_TYPE_UNKNOWN);
      g_free (name);

      geocode_place_set_country (place,
                                 folks_postal_address_get_country (addr));
      geocode_place_set_state (place,
                               folks_postal_address_get_region (addr));
      geocode_place_set_postal_code (place,
                                     folks_postal_address_get_postal_code (addr));
      geocode_place_set_town (place,
                              folks_postal_address_get_locality (addr));
      geocode_place_set_street_address (place,
                                        folks_postal_address_get_street (addr));

      maps_contact_add_place (contact, place);
    }

  return contact;
}

MapsContactStore *
maps_contact_store_new ()
{
  return g_object_new (MAPS_TYPE_CONTACT_STORE, NULL);
}

static void
maps_contact_store_lookup_cb (FolksIndividualAggregator     *aggregator,
                              GAsyncResult                  *res,
                              MapsContactStoreLookupCallback callback)
{
  FolksIndividual *individual;

  individual = folks_individual_aggregator_look_up_individual_finish (aggregator,
                                                                      res,
                                                                      NULL);
  if (individual != NULL)
    {
      MapsContact *contact = get_contact (individual);
      callback (contact);
    }
  else
    {
      callback (NULL);
    }
}

/**
 * maps_contact_store_lookup:
 * @store: A #MapsContactStore object
 * @callback: (scope async): A #MapsContactStoreLookupCallback function
 */
void
maps_contact_store_lookup (MapsContactStore              *store,
                           const char                    *id,
                           MapsContactStoreLookupCallback callback)
{
  folks_individual_aggregator_look_up_individual (store->priv->aggregator,
                                                  id,
                                                  (GAsyncReadyCallback) maps_contact_store_lookup_cb,
                                                  callback);
}

static void
aggregator_quiescent_notify (FolksIndividualAggregator *aggregator,
                             GParamSpec                *pspec,
                             MapsContactStore          *store)
{
  GeeMap *map;
  GeeMapIterator *iter;

  map = folks_individual_aggregator_get_individuals (aggregator);
  iter = gee_map_map_iterator (map);

  while (gee_map_iterator_has_next (iter))
    {
      MapsContact *contact;

      gee_map_iterator_next (iter);
      contact = get_contact (gee_map_iterator_get_value (iter));
      if (contact)
        store->priv->list = g_list_prepend (store->priv->list, contact);
    }

  store->priv->state = MAPS_CONTACT_STORE_STATE_LOADED;
  g_object_notify (G_OBJECT (store), "state");
}

static void
aggregator_prepare (FolksIndividualAggregator *aggregator,
                    GAsyncResult              *res,
                    gpointer                   user_data)
{
  folks_individual_aggregator_prepare_finish (aggregator, res, NULL);
}

/**
 * maps_contact_store_load:
 * @store: A #MapsContactStore object
 *
 * Load contacts from available backends.
 *
 */
void
maps_contact_store_load (MapsContactStore *store)
{
  g_return_if_fail (MAPS_IS_CONTACT_STORE (store));

  store->priv->aggregator = folks_individual_aggregator_dup ();

  g_signal_connect (G_OBJECT (store->priv->aggregator),
                    "notify::is-quiescent",
                    G_CALLBACK (aggregator_quiescent_notify),
                    store);

  store->priv->state = MAPS_CONTACT_STORE_STATE_LOADING;
  g_object_notify (G_OBJECT (store), "state");

  folks_individual_aggregator_prepare (store->priv->aggregator,
                                       (GAsyncReadyCallback) aggregator_prepare,
                                       NULL);
}

/**
 * maps_contact_store_get_contacts:
 * @store: A #MapsContactStore object
 *
 * Returns: (element-type MapsContact) (transfer container): a list of #MapsContact,
 */
GList *
maps_contact_store_get_contacts (MapsContactStore *store)
{
  g_return_val_if_fail (MAPS_IS_CONTACT_STORE (store), NULL);

  return store->priv->list;
}
