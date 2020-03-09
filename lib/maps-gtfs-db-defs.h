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

#pragma once

#define N_TABLES 10

#define CREATE_TABLE_AGENCY "CREATE TABLE agency (agency_id       TEXT, " \
                                                 "agency_name     TEXT NOT NULL, " \
                                                 "agency_url      NAME NOT NULL, " \
                                                 "agency_timezone TEXT NOT NULL, " \
                                                 "agency_lang     VARCHAR(5), " \
                                                 "agency_phone    TEXT, " \
                                                 "agency_fare_url TEXT, " \
                                                 "agency_email    TEXT)"

#define CREATE_TABLE_STOPS "CREATE TABLE stops (stop_id             TEXT NOT NULL, " \
                                               "stop_code           TEXT, " \
                                               "stop_name           TEXT, " \
                                               "stop_desc           TEXT, " \
                                               "stop_lat            REAL, " \
                                               "stop_lon            REAL, " \
                                               "zone_id             TEXT, " \
                                               "stop_url            TEXT, " \
                                               "location_type       TINYINT, " \
                                               "parent_station      TEXT, " \
                                               "stop_timezone       TEXT, " \
                                               "wheelchair_boarding TINYINT, " \
                                               "level_id            TEXT, " \
                                               "platform_code       TEXT)"

#define CREATE_TABLE_ROUTES "CREATE TABLE routes (route_id         TEXT NOT NULL, " \
                                                 "agency_id        TEXT, " \
                                                 "route_short_name TEXT, " \
                                                 "route_long_name  TEXT, " \
                                                 "route_desc       TEXT, " \
                                                 "route_type       INTEGER NOT NULL, " \
                                                 "route_url        TEXT, " \
                                                 "route_color      CHARACTER(6), " \
                                                 "route_text_color CHARACTER(6), " \
                                                 "route_sort_order INTEGER)"

#define CREATE_TABLE_TRIPS "CREATE TABLE trips (route_id              TEXT NOT NULL, " \
                                               "service_id            TEXT NOT NULL, " \
                                               "trip_id               TEXT NOT NULL, " \
                                               "trip_headsign         TEXT, " \
                                               "trip_short_name       TEXT, " \
                                               "direction_id          BOOLEAN, " \
                                               "block_id              TEXT, " \
                                               "shape_id              TEXT, " \
                                               "wheelchair_accessible TINYINT, " \
                                               "bikes_allowed         TINYINT)"

#define CREATE_TABLE_STOP_TIMES "CREATE TABLE stop_times (" \
                                                   "trip_id        TEXT NOT NULL, " \
                                                   "arrival_time   INTEGER, " \
                                                   "departure_time INTEGER, " \
                                                   "stop_id        TEXT NOT NULL, " \
                                                   "stop_sequence  TEXT NOT NULL, " \
                                                   "stop_headsign  TEXT, " \
                                                   "pickup_type    TINYINT, " \
                                                   "drop_off_type  TINYINT, " \
                                                   "shape_dist_tavelled FLOAT, " \
                                                   "timepoint      BOOLEAN)"

#define CREATE_TABLE_CALENDAR "CREATE TABLE calendar (service_id TEXT NOT NULL, " \
                                                     "monday     BOOLEAN NOT NULL, " \
                                                     "tuesday    BOOLEAN NOT NULL, " \
                                                     "wednesday  BOOLEAN NOT NULL, " \
                                                     "thursday   BOOLEAN NOT NULL, " \
                                                     "friday     BOOLEAN NOT NULL, " \
                                                     "saturday   BOOLEAN NOT NULL, " \
                                                     "sunday     BOOLEAN NOT NULL, " \
                                                     "start_date INTEGER NOT NULL, " \
                                                     "end_date   INTEGER NOT NULL)"

#define CREATE_TABLE_CALENDAR_DATES "CREATE TABLE calendar_dates (" \
                                                  "service_id     TEXT NOT NULL, " \
                                                  "date           INTEGER NOT NULL, " \
                                                  "exception_type TINYINT NOT NULL)"

#define CREATE_TABLE_SHAPES "CREATE TABLE shapes (shape_id            TEXT NOT NULL, " \
                                                 "shape_pt_lat        FLOAT NOT NULL, " \
                                                 "shape_pt_lon        FLOAT NOT NULL, " \
                                                 "shape_pt_sequence   INTEGER NOT NULL, " \
                                                 "shape_dist_traveled FLOAT)"

#define CREATE_TABLE_FREQUENCIES "CREATE TABLE frequencies (" \
                                                 "trip_id      TEXT NOT NULL, " \
                                                 "start_time   INTEGER NOT NULL, " \
                                                 "end_time     INTEGER NOT NULL, " \
                                                 "headway_secs INTEGER NOT NULL, " \
                                                 "exact_times  TINYINT)"

#define CREATE_TABLE_TRANSFERS "CREATE TABLE transfers (" \
                                                 "from_stop_id      TEXT NOT NULL, " \
                                                 "to_stop_id        TEXT NOT NULL, " \
                                                 "transfer_type     TINYINT NOT NULL, " \
                                                 "min_transfer_time INTEGER)"


#define N_INDICES 4

#define CREATE_INDEX_STOPS_STOP_ID "CREATE INDEX stops_stop_id ON stops (stop_id)"

#define CREATE_INDEX_STOP_TIMES_STOP_ID "CREATE INDEX stop_times_stop_id " \
                                        "ON stop_times (stop_id)"

#define CREATE_INDEX_TRIPS_TRIP_ID "CREATE INDEX trips_trip_id ON trips (trip_id)"

#define CREATE_INDEX_ROUTES_ROUTE_ID "CREATE INDEX routes_route_id " \
                                     "ON routes (route_id)"
