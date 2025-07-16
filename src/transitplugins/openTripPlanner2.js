/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2023 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import gettext from 'gettext';

import GLib from 'gi://GLib';
import Shumate from 'gi://Shumate';
import Soup from 'gi://Soup';

import {Application} from '../application.js';
import * as Epaf from '../epaf.js';
import * as HVT from '../hvt.js';
import * as NeTeX from '../netex.js';
import {TurnPoint} from '../route.js';
import * as Time from '../time.js';
import {Itinerary, Leg, RouteType, Stop} from '../transitPlan.js';
import * as Utils from '../utils.js';

const _ = gettext.gettext;

const KNOWN_BASE_URLS = ['https://api.entur.io/journey-planner/v3/graphql'];

export class OpenTripPlanner2 {
     constructor(params) {
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
        this._plan = Application.routingDelegator.transitRouter.plan;
        this._query = Application.routeQuery;
        this._baseUrl = GLib.getenv('OTP_BASE_URL') ?? params?.baseUrl;
        this._authHeader = GLib.getenv('OTP_AUTH_HEADER') ?? params?.authHeader;
        this._authKey = GLib.getenv('OTP_AUTH_KEY') ?? params?.authKey;

        if (!this._isValidParams(params))
            throw new Error('invalid parameters');

        if (!this._baseUrl)
            throw new Error('must specify baseUrl as an argument');
    }

    cancelCurrentRequest() {
        //Do nothing.
    }

    _isValidParams(params) {
        // refuse to use unknown URLs to OTP instances
        if (params?.baseUrl && KNOWN_BASE_URLS.indexOf(params.baseUrl) === -1) {
            Utils.debug(`refusing unknown base URL ${params.baseUrl}`);
            return false;
        }

        return true;
    }

    fetchFirstResults() {
        /* haven't quite wrapped my head around how via trips work
         * so for now skip this...
         */
        if (this._query.filledPoints.length > 2) {
            Utils.debug('Doesn\'t support via points yet');
            this._plan.reset();
            this._plan.requestFailed();
            this._query.reset();
        } else {
            this._fetchResults();
        }
    }

    fetchMoreResults() {
        this._fetchResults(true);
    }

    _fetchResults(extendPrevious = false) {
        const body = this._getBody(extendPrevious);
        const request = Soup.Message.new_from_encoded_form('POST', this._baseUrl,
                                                         body);

        request.request_headers.replace('Content-Type', 'application/json');
        request.request_headers.replace('Accept', 'application/json');

        if (this._authHeader && this._authKey)
            request.request_headers.append(this._authHeader, this._authKey);

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null,
                                          (source, res) => {
            const buffer = this._session.send_and_read_finish(res).get_data();

            if (request.get_status() !== Soup.Status.OK) {
                Utils.debug('Failed to get trip: ' + request.get_status());
                Utils.debug(`out ${Utils.getBufferText(buffer)}`);
                this._plan.requestFailed();
                this._plan.reset();
            } else {
                const result = JSON.parse(Utils.getBufferText(buffer));
                Utils.debug('result: ' + JSON.stringify(result, null, 2));

                this._parseTrip(result, extendPrevious);
            }
        });
    }

    _parseTrip(result, extendPrevious) {
        const tripPatterns = result?.data?.trip?.tripPatterns;

        this._nextPageCursor = result?.data?.trip?.nextPageCursor;
        this._previousPageCursor =
            result?.data?.trip?.previousPageCursor;

        if (!Array.isArray(tripPatterns) || tripPatterns.length === 0) {
            Utils.debug('no trips found');
            this._plan.noRouteFound();

            return;
        }

        try {
            const filledPoints = this._query.filledPoints;
            const originPlace = filledPoints[0].place;
            const destinationPlace = filledPoints.last().place;
            const itineraries =
                tripPatterns.map(tripPattern =>
                                 this._parseTripPattern(tripPattern,
                                                        originPlace,
                                                        destinationPlace));

            this._plan.updateWithNewItineraries(itineraries,
                                                this._query.arriveBy,
                                                extendPrevious);
        } catch (error) {
            Utils.debug(`error parsing trip patterns ${error} ${error.stack}`);
            this._plan.requestFailed();
            this._plan.reset();
        }
    }

    _parseTripPattern(tripPattern, originPlace, destinationPlace) {
        if (!Array.isArray(tripPattern.legs) || tripPattern.legs.length === 0)
            throw 'No legs found in tripPattern';

        const legs =
            this._parseLegs(tripPattern.legs, originPlace, destinationPlace);
        const firstLeg = legs[0];
        const lastLeg = legs.last();
        const duration = (lastLeg.arrival - firstLeg.departure) / 1000;

        return new Itinerary({ departure:               firstLeg.departure,
                               departureTimezoneOffset: firstLeg.departureTimezoneOffset,
                               arrival:                 lastLeg.arrival,
                               arrivalTimezoneOffset:   lastLeg.arrivalTimezoneOffset,
                               duration:                duration,
                               legs:                    legs });
    }

    _parseLegs(legs, originPlace, destinationPlace) {
        // filter out starting and ending walking legs if shorter than 30 m
        return legs.filter((leg, index) => {
                            return index !== 0 && index != legs.length - 1 ||
                                   leg.mode !== 'foot' || leg.distance >= 30; })
                   .map((leg, index, arr) => {
            const [departure, departureTz] =
                Time.parseTime(leg.expectedStartTime);
            const [arrival, arrivalTz] =
                Time.parseTime(leg.expectedEndTime);
            const isTransit = leg.mode !== 'foot';
            const points = leg?.pointsOnLink?.points;
            const fromPlace = leg.fromPlace;
            const toPlace = leg.toPlace;
            const fromCoordinate = [fromPlace.latitude, fromPlace.longitude];
            const toCoordinate = [toPlace.latitude, toPlace.longitude];
            const headsign = leg?.toEstimatedCall?.destinationDisplay?.frontText;
            const route = leg?.line?.publicCode ?? '';
            const routeType =
                isTransit ? NeTeX.toHVT(leg.mode, leg.transportSubmode) : null;
            const walkingInstructions =
                !isTransit ?
                this._parseSteps(leg.steps, fromCoordinate, toCoordinate) : null;
            const intermediateStops =
                isTransit ?
                this._parseIntermediate(leg, toPlace.name, toCoordinate,
                                        arrival, arrivalTz) :
                null;
            const polyline =
                points && points.length < 2000 ? Epaf.decode(points) : null;
            const agencyName = leg?.line?.authority?.name;
            const agencyUrl = leg?.line?.authority?.url;
            const color = leg?.line?.presentation?.colour;
            const textColor = leg?.line?.presentation?.textColour;
            /* for first and final walking legs, use orignal place name from
             * from place entered by user when using search results
             */
            const from =
                index === 0 && !isTransit ? originPlace.name : fromPlace.name;
            const to =
                index === arr.length - 1 && !isTransit ?
                destinationPlace.name : toPlace.name;

            return new Leg({ isTransit:               isTransit,
                             route:                   route,
                             routeType:               routeType,
                             color:                   color,
                             textColor:               textColor,
                             departure:               departure,
                             departureTimezoneOffset: departureTz,
                             arrival:                 arrival,
                             arrivalTimezoneOffset:   arrivalTz,
                             from:                    from,
                             fromCoordinate:          fromCoordinate,
                             agencyName:              agencyName,
                             agencyUrl:               agencyUrl,
                             to:                      to,
                             toCoordinate:            toCoordinate,
                             headsign:                headsign,
                             distance:                leg.distance,
                             polyline:                polyline,
                             intermediateStops:       intermediateStops,
                             walkingInstructions:     walkingInstructions });
        });
    }

    _parseSteps(steps, fromCoordinate, toCoordinate) {
        // create starting turnpoint instruction based on leg
        const startTurnpoint = new TurnPoint({ type:        TurnPoint.Type.START,
                                               distance:    0,
                                               instruction: _("Start"),
                                               coordinate:  fromCoordinate });

        const intermediateTurnpoints = steps.map((step) => {
            const [type, instruction] =
                this._getTurnpointTypeAndInstruction(step);
            const coordinate =
                new Shumate.Coordinate({ latitude:  step.latitude,
                                         longitude: step.longitude });

            return new TurnPoint({ type:        type,
                                   distance:    step.distance,
                                   instruction: instruction,
                                   coordinate:  coordinate });
        });

        // add ending turnPoint
        const endTurnpoint = new TurnPoint({ type:        TurnPoint.Type.END,
                                             distance:    0,
                                             instruction: _("Arrive"),
                                             coordinate:  toCoordinate });

        return [startTurnpoint, ...intermediateTurnpoints, endTurnpoint];
    }

    _getTurnpointTypeAndInstruction(step) {
        switch (step.relativeDirection) {
            case 'depart':
            case 'continue':
                return [TurnPoint.Type.CONTINUE,
                        step.street ? _("Continue on %s").format(step.street) :
                                      _("Continue")];
            case 'left':
                return [TurnPoint.Type.LEFT,
                        step.street ? _("Turn left on %s").format(step.street) :
                                      _("Turn left")];
            case 'slightlyLeft':
                return [TurnPoint.Type.SLIGHT_LEFT,
                        step.street ?
                        _("Turn slightly left on %s").format(step.street) :
                        _("Turn slightly left")];
            case 'hardLeft':
                return [TurnPoint.Type.SHARP_LEFT,
                        step.street ?
                        _("Turn sharp left on %s").format(step.street) :
                        _("Turn sharp left")];
            case 'right':
                return [TurnPoint.Type.RIGHT,
                        step.street ? _("Turn right on %s").format(step.street) :
                                      _("Turn right")];
            case 'slightlyRight':
                return [TurnPoint.Type.SLIGHT_RIGHT,
                        step.street ?
                        _("Turn slightly right on %s").format(step.street) :
                        _("Turn slightly right")];
            case 'hardRight':
                return [TurnPoint.Type.SHARP_RIGHT,
                        step.street ?
                        _("Turn sharp right on %s").format(step.street) :
                        _("Turn sharp right")];
            case 'circleClockwise':
            case 'circleCounterclockwise': {
                let instruction;

                if (step.exit) {
                    instruction =
                        _("At the roundabout, take exit %s").format(step.exit);
                } else if (step.street) {
                    instruction =
                        _("At the roundabout, take exit to %s").format(step.street);
                } else {
                    instruction = _("Take the roundabout");
                }

                return [TurnPoint.Type.ROUNDABOUT, instruction];
            }
            case 'elevator':
                return [TurnPoint.Type.ELEVATOR,
                        step.street ?
                        _("Take the elevator and get off at %s").format(step.street) :
                        _("Take the elevator")];
            case 'uturnLeft':
                return [TurnPoint.Type.UTURN_LEFT,
                        step.street ?
                        _("Make a left u-turn onto %s").format(step.street) :
                        _("Make a left u-turn")];
            case 'uturnRight':
                return [TurnPoint.Type.UTURN_RIGHT,
                        step.street ?
                        _("Make a right u-turn onto %s").format(step.street) :
                        _("Make a right u-turn")];
            default:
                throw 'unknown direction ' + step.relativeDirection;
        }
    }

    _parseIntermediate(leg, to, toCoordinate, arrival, arrivalTz) {
        const intermediateStops =
            leg.intermediateEstimatedCalls.map((stop) => {
                const [arrival, arrivalTz] =
                    Time.parseTime(stop.expectedArrivalTime);
                const [departure, _] = Time.parseTime(stop.expectedDepartureTime);

                return new Stop({ name:                 stop.quay.name,
                                  arrival:              arrival,
                                  departure:            departure,
                                  agencyTimezoneOffset: arrivalTz,
                                  coordinate:           [stop.quay.latitude,
                                                         stop.quay.longitude] });
        });

        // add arrival at the final stop (the same as the destination for the leg)
        const finalStop = new Stop({ name:                 to,
                                     coordinate:           toCoordinate,
                                     arrival:              arrival,
                                     agencyTimezoneOffset: arrivalTz });

        return [...intermediateStops, finalStop];
    }

    _getBody(extendPrevious) {
        const numQueryPoints = this._query.filledPoints.length;
        const graphQL = numQueryPoints > 2 ?
                        this._getViaTripGraphQLBody() :
                        this._getTripGraphQLBody(extendPrevious);

        return `{ "query": "${graphQL}"}`;
    }

    _getDateTimeParam() {
        if (this._query.time) {
            // if query doesn't specify date, use current day
            const date =
                this._query.date ?? (new Date()).toISOString().substring(0, 10);
            return `dateTime: \\"${date}T${this._query.time}\\",`;
        } else {
            return '';
        }
    }

    _getPageCursorParam(extendPrevious) {
        if (extendPrevious) {
            const pageCursor = this._query.arriveBy ?
                               this._previousPageCursor : this._nextPageCursor;

            return `pageCursor: \\"${pageCursor}\\"`;
        } else {
            return '';
        }
    }

    _transitTypeToMode(transitType) {
        switch (transitType) {
            case RouteType.BUS:
                return 'bus';
            case RouteType.TRAM:
                return 'tram';
            case RouteType.TRAIN:
                return 'rail';
            case RouteType.SUBWAY:
                return 'metro';
            case RouteType.FERRY:
                return 'water';
            case HVT.AIR_SERVICE:
                return 'air';
            default:
                throw 'unkown transit type: ' + transitType;
        }
    }


    _getModes() {
        const types = this._query.transitOptions.transitTypes;

        return types.reduce((a, t, i) => {
            const mode = this._transitTypeToMode(t);
            const trailer = i !== types.length - 1 ? ',' : '';

            return a + `{ transportMode: ${mode} }` + trailer;
        }, '');
    }

    _getFiltersParam() {
        const modesBody = this._getModes();

        return `filters: [{ select: [ { transportModes: [ ${modesBody} ] } ] } ]`;
    }

    _getModeParam() {
        if (this._query.transitOptions.showAllTransitTypes) {
            return '';
        } else {
            return `${this._getFiltersParam()},`;
        }
    }

    _getCoordinatesParam(point) {
        const location = point.place.location;

        return `coordinates: { latitude: ${location.latitude}, longitude: ${location.longitude} }`;
    }

    _getTripPatternsOutput() {
        return `
tripPatterns {
  legs {
    mode,
    transportSubmode,
    distance,
    pointsOnLink {
        points
    },
    expectedStartTime,
    expectedEndTime,
    fromPlace {
        name,
        latitude,
        longitude
    }
    toPlace {
        name,
        latitude,
        longitude
    }
    toEstimatedCall {
      destinationDisplay {frontText}
    }
    steps {
      bogusName,
      streetName,
      longitude,
      latitude,
      relativeDirection,
      distance
    }
    intermediateEstimatedCalls {
      expectedArrivalTime,
      expectedDepartureTime,
      quay {
        name,
        latitude,
        longitude
      }
    }
    line {
      publicCode,
      presentation {
        colour,
        textColour
      }
      authority {
        name,
        url
      }
    }
  }
}`;
    }

    _getTripGraphQLBody(extendPrevious) {
        return `{
  trip(
    from: { ${this._getCoordinatesParam(this._query.filledPoints[0])} }
    to: { ${this._getCoordinatesParam(this._query.filledPoints.last())} }
    numTripPatterns: 10,
    walkSpeed: 1.3,
    searchWindow: 720,
    ${this._getDateTimeParam()}
    arriveBy: ${this._query.arriveBy},
    ${this._getModeParam()}
    ${this._getPageCursorParam(extendPrevious)}
  ) {
    nextPageCursor,
    previousPageCursor,
    ${this._getTripPatternsOutput()}
  }
}`.replace(/(\r\n|\n|\r)/gm, '');
    }

    _getViaPlacesParams() {
        return this._query.filledPoints.slice(1, -1).map((p) => {
            return `{ ${this._getCoordinatesParam(p)} }`;
        }).toString();
    }

    _getSegmentsParam() {
        if (this._query.transitOptions.showAllTransitTypes) {
            return '';
        } else {
            const filtersParam = this._getFiltersParam();
            const filters = this._query.filledPoints.slice(1).map((p) => {
                return `{ ${filtersParam} }`;
            }).toString()

            return `segments: [ ${filters} ],`;
        }
    }
}
