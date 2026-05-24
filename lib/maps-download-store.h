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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: James Westman <james@jwestman.net>
 */

#pragma once

#include <gio/gio.h>

G_BEGIN_DECLS

#define MAPS_TYPE_DOWNLOAD_STORE (maps_download_store_get_type())
G_DECLARE_FINAL_TYPE (MapsDownloadStore, maps_download_store, MAPS, DOWNLOAD_STORE, GObject)

MapsDownloadStore *maps_download_store_new (void);

gboolean maps_download_store_open (MapsDownloadStore *self,
                                   const char        *path,
                                   GError           **error);

void maps_download_store_insert_async (MapsDownloadStore    *self,
                                       const char           *tileset,
                                       const char          **ids,
                                       GBytes               *data,
                                       gboolean              precompressed,
                                       guint64               mtime,
                                       GAsyncReadyCallback   callback,
                                       gpointer              user_data);
gboolean maps_download_store_insert_finish (MapsDownloadStore  *self,
                                            GAsyncResult       *result,
                                            GError            **error);

void maps_download_store_remove_async (MapsDownloadStore    *self,
                                       const char           *tileset,
                                       const char          **ids,
                                       GAsyncReadyCallback   callback,
                                       gpointer              user_data);
gboolean maps_download_store_remove_finish (MapsDownloadStore *self,
                                            GAsyncResult      *result,
                                            GError           **error);

void maps_download_store_get_async (MapsDownloadStore *self,
                                    const char        *tileset,
                                    const char        *id,
                                    GAsyncReadyCallback callback,
                                    gpointer           user_data);
GBytes *maps_download_store_get_finish (MapsDownloadStore *self,
                                        GAsyncResult      *result,
                                        GError           **error);

void maps_download_store_exec_async (MapsDownloadStore *self,
                                     const char        *sql,
                                     GAsyncReadyCallback callback,
                                     gpointer user_data);
gboolean maps_download_store_exec_finish (MapsDownloadStore *self,
                                          GAsyncResult *result,
                                          GError **error);

void maps_download_store_list_tilesets_async (MapsDownloadStore    *self,
                                              GAsyncReadyCallback   callback,
                                              gpointer              user_data);

char **maps_download_store_list_tilesets_finish (MapsDownloadStore  *self,
                                                 GAsyncResult       *result,
                                                 GError            **error);

void maps_download_store_list_tiles_async (MapsDownloadStore     *self,
                                           const char            *tileset,
                                           GAsyncReadyCallback    callback,
                                           gpointer               user_data);
char **maps_download_store_list_tiles_finish (MapsDownloadStore  *self,
                                              GAsyncResult       *result,
                                              GError            **error);

void maps_download_store_compute_size_async (MapsDownloadStore    *self,
                                             const char           *tileset,
                                             const char          **tile_ids,
                                             GAsyncReadyCallback   callback,
                                             gpointer              user_data);
gsize maps_download_store_compute_size_finish (MapsDownloadStore  *self,
                                               GAsyncResult       *result,
                                               GError            **error);

void maps_download_store_filter_by_mtime_async (MapsDownloadStore    *self,
                                                const char           *tileset,
                                                const char          **tile_ids,
                                                guint64               mtime,
                                                GAsyncReadyCallback   callback,
                                                gpointer              user_data);
char **maps_download_store_filter_by_mtime_finish (MapsDownloadStore  *self,
                                                   GAsyncResult       *result,
                                                   GError            **error);

G_END_DECLS
