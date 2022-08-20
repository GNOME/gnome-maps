/*
 * Copyright (c) 2015 Marcus Lundblad
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

#include "maps-osm-oauth-proxy-call.h"

#include <glib.h>
#include <rest/rest-proxy-call.h>
#include <string.h>

#define MAPS_OSM_OAUTH_PROXY_CALL_GET_PRIVATE(obj)                         \
        (G_TYPE_INSTANCE_GET_PRIVATE((obj), MAPS_TYPE_OSM_OAUTH_PROXY_CALL,\
         MapsOSMOAuthProxyCallPrivate))

struct _MapsOSMOAuthProxyCallPrivate
{
  char *payload;
};

G_DEFINE_TYPE_WITH_PRIVATE(MapsOSMOAuthProxyCall, maps_osm_oauth_proxy_call,
                           REST_TYPE_OAUTH2_PROXY_CALL);

static gboolean
maps_osm_oauth_proxy_call_serialize_params (RestProxyCall *call,
                                            gchar **content_type,
                                            gchar **content,
                                            gsize *content_len,
                                            GError **error)
{
  g_return_val_if_fail(MAPS_IS_OSM_OAUTH_PROXY_CALL (call), FALSE);
  g_return_val_if_fail(content_type != NULL, FALSE);
  g_return_val_if_fail(content != NULL, FALSE);
  g_return_val_if_fail(content_len != NULL, FALSE);

  gchar *payload = (MAPS_OSM_OAUTH_PROXY_CALL (call))->priv->payload;

  *content_type = g_strdup ("text/xml");
  *content = g_strdup (payload);
  *content_len = strlen (payload);

  return TRUE;
}

static void
maps_osm_oauth_proxy_call_dispose (GObject *object)
{
  MapsOSMOAuthProxyCall *call = MAPS_OSM_OAUTH_PROXY_CALL (object);

  g_free (call->priv->payload);
  call->priv->payload = NULL;

  G_OBJECT_CLASS (maps_osm_oauth_proxy_call_parent_class)->dispose (object);
}

static void
maps_osm_oauth_proxy_call_class_init (MapsOSMOAuthProxyCallClass *klass)
{
  RestProxyCallClass *proxy_call_class = REST_PROXY_CALL_CLASS (klass);
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  proxy_call_class->serialize_params =
    maps_osm_oauth_proxy_call_serialize_params;
  gobject_class->dispose = maps_osm_oauth_proxy_call_dispose;
}

static void
maps_osm_oauth_proxy_call_init (MapsOSMOAuthProxyCall *call)
{
  call->priv = MAPS_OSM_OAUTH_PROXY_CALL_GET_PRIVATE (call);
}

MapsOSMOAuthProxyCall *
maps_osm_oauth_proxy_call_new (RestOAuth2Proxy *proxy, const char *payload)
{
  g_return_val_if_fail (REST_IS_OAUTH2_PROXY (proxy), NULL);
  g_return_val_if_fail (payload != NULL, NULL);

  MapsOSMOAuthProxyCall *call =
    g_object_new (MAPS_TYPE_OSM_OAUTH_PROXY_CALL, "proxy", proxy, NULL);

  call->priv->payload = g_strdup (payload);

  return call;
}


