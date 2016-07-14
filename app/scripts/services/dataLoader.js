'use strict';

angular.module('trackerApp').factory('dataLoader', [
    '$window',
    '$http',
    '$q',
    'X2JS',
    '_', function ($window, $http, $q, X2JS, _) {

    //base URL for API
    const URL = 'http://webservices.nextbus.com/service/publicXMLFeed';

    // jscs:disable
    var x2js = new X2JS();

    this.getRouteLocation = function (selectedRoute, visDrawer) {

        //used for 15 second update
        var lastTime;

        $http.get(URL, {
            params: {
                command: 'vehicleLocations',
                a: 'sf-muni',
                r: selectedRoute.tag,
                t: lastTime
            }
        }).then(function (data) {

            //success
            var res = x2js.xml_str2json(data.data).body;
            lastTime = res.lastTime._time;

            //vehicles that does not have "_dirTag" are ommitted
            //(assuming there are not in service)
            //consider vehicles whose direction is original one from the route info
            var validVehicles = _.filter(angular.copy(res.vehicle), function (v) {
                return _.contains(_.keys(selectedRoute.countByDir), v._dirTag);
            });
            var vehicleGeoJson = {
                geometry: {
                    type: 'MultiPoint',
                    coordinates: _.map(angular.copy(validVehicles), function (v) {
                        return [v._lon, v._lat];
                    })
                },
                properties: {
                    angles: _.pluck(angular.copy(validVehicles), '_heading'),
                    vehicleIds: _.pluck(angular.copy(validVehicles), '_id'),
                    dirTags: _.pluck(angular.copy(validVehicles), '_dirTag')
                }
            };
            visDrawer(vehicleGeoJson, selectedRoute);

            //update main $scope.selectedRoutes
            var byDirection = _.groupBy(angular.copy(validVehicles), function (v) {
                return v._dirTag;
            });
            _.each(byDirection, function (array, tag) {
                if (selectedRoute.countByDir[tag]) {
                    selectedRoute.countByDir[tag].count = array.length;
                }
            });

        }, function () {
            //fail
            visDrawer(null, selectedRoute);
            selectedRoute.count = 'N/A';
        });
    };

    return this;
}]);
