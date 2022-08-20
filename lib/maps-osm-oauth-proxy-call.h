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

#ifndef MAPS_OSM_OAUTH_PROXY_CALL_H
#define MAPS_OSM_OAUTH_PROXY_CALL_H

#include <glib-object.h>

#include <rest/rest-oauth2-proxy-call.h>
#include <rest/rest-oauth2-proxy.h>

G_BEGIN_DECLS

#define MAPS_TYPE_OSM_OAUTH_PROXY_CALL            (maps_osm_oauth_proxy_call_get_type ())
#define MAPS_OSM_OAUTH_PROXY_CALL(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), MAPS_TYPE_OSM_OAUTH_PROXY_CALL, MapsOSMOAuthProxyCall))
#define MAPS_OSM_OAUTH_PROXY_CALL_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass), MAPS_TYPE_OSM_OAUTH_PROXY_CALL, MapsOSMOAuthProxyCallClass))
#define MAPS_IS_OSM_OAUTH_PROXY_CALL(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), MAPS_TYPE_OSM_OAUTH_PROXY_CALL))
#define MAPS_IS_OSM_OAUTH_PROXY_CALL_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), MAPS_TYPE_OSM_OAUTH_PROXY_CALL))
#define MAPS_OSM_OAUTH_GET_CLASS(obj)             (G_TYPE_INSTANCE_GET_CLASS ((obj), MAPS_TYPE_OSM_OAUTH_PROXY_CALL, MapsOSMOAuthProxyCallClass))

typedef struct _MapsOSMOAuthProxyCall MapsOSMOAuthProxyCall;
typedef struct _MapsOSMOAuthProxyCallPrivate MapsOSMOAuthProxyCallPrivate;
typedef struct _MapsOSMOAuthProxyCallClass MapsOSMOAuthProxyCallClass;

struct _MapsOSMOAuthProxyCall
{
  RestOAuth2ProxyCall parent;
  MapsOSMOAuthProxyCallPrivate *priv;
};

struct _MapsOSMOAuthProxyCallClass
{
  RestOAuth2ProxyCallClass parent_class;
};

GType maps_osm_oauth_proxy_call_get_type(void);
MapsOSMOAuthProxyCall *maps_osm_oauth_proxy_call_new (RestOAuth2Proxy *proxy,
                                                      const char *content);

G_END_DECLS

#endif /* MAPS_OSM_OAUTH_PROXY_CALL_H */
