#pragma once

#include <glib-object.h>

G_BEGIN_DECLS

#define MAPS_TYPE_GTFS_ROUTE (maps_gtfs_route_get_type())

G_DECLARE_FINAL_TYPE (MapsGTFSRoute, maps_gtfs_route, MAPS, GTFS_ROUTE, GObject)

struct _MapsGTFSRouteClass
{
  GObjectClass parent_class;
};

MapsGTFSRoute *maps_gtfs_route_new (gchar *id, gchar *agency_id,
                                    gchar *short_name,
                                    gchar *long_name, guint16 type, gchar *color,
                                    gchar *text_color);

G_END_DECLS
