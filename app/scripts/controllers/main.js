'use strict';

angular.module('trackerApp').controller('MainCtrl', [
    '$scope',
    '$location',
    '$window',
    '$http',
    '_',
    'mapDrawer',
    'routeManager',
    'routeJsonGenerator',
    function ($scope, $location, $window, $http, _, mapDrawer, routeManager, routeJsonGenerator) {

        /****
        //generate route data only once
        //this creates base map data (routes.json) should be generated
        //once routes.json exists, it's not used for map drawing
        ****/
        $http.get('data/routes.json').error(function () {
            routeJsonGenerator.getAllMuniRoutes();
            return false;
        });
        /* end of data generation */

        //max number of vehicles seen and frequency of update
        $scope.maxRouteNum = 5;
        $scope.frequency = 15 * 1000;

        /****
        //Models - selected Routes, allRoutes
        //1. basic info of all routes is generated from routes.json after drawing base map
        //2. real time status is updated from vehicle location API with routeManager.js
        //3. location of each vehicle is updated the vis in mapDrawer.js
        ****/

        $scope.allRoutes = [];
        $scope.selectedRoutes = [];
        $scope.isInfoOpen = [];

        //setTimeout variables for each route
        var callAPIsetTimeouts = {};

        $scope.selectRoute = function (id, tag) {

            //when more than max routes are selected
            if ($scope.selectedRoutes.length === $scope.maxRouteNum) {
                $scope.error = true;
                return false;
            }

            //get the selected route object base info from all routes first
            var baseInfo = _.filter($scope.allRoutes, function (r) {
                return r.tag === tag;
            })[0];
            var newRoute = routeManager.initNewRoute(id, tag, baseInfo, $scope.selectedRoutes);

            //update models
            $scope.selectedRoutes.push(newRoute);
            $scope.allRoutes[id].selected = true;

            //call API every 15 seconds
            (function callAPI() {
                routeManager.getRouteLocation(newRoute, mapDrawer);
                callAPIsetTimeouts[tag] = setTimeout(callAPI, $scope.frequency);
            })();

        };

        $scope.removeRoute = function (id, tag) {

            //stop the setTimeout
            clearTimeout(callAPIsetTimeouts[tag]);

            //remove the selected route
            $scope.selectedRoutes = _.filter($scope.selectedRoutes, function (route) {
                return route.tag !== tag;
            });
            //because now the number of selected routes is alreays less than 5
            $scope.error = false;

            //unmark deselected routes from the route list
            for (var i = 0; i < $scope.allRoutes.length; i++) {
                if ($scope.allRoutes[i].tag === tag) {
                    $scope.allRoutes[i].selected = false;
                    break;
                }
            }
            //close info
            $scope.isInfoOpen[id] = false;

            //update map
            mapDrawer.removeRoute(tag);
        };

        $scope.toggleDirection = function (id, routeTag, dirTag, val) {
            $scope.selectedRoutes[id].directions[dirTag].isHidden = val;
            mapDrawer.toggleDirection(routeTag, dirTag, val);
        };

        $scope.showRouteInfo = function (id, tag, status) {
            $scope.isInfoOpen[id] = !status;
        };

        //when loading is done, set all routes for dropdown
        function setLoadingDone(routesData) {
            if (routesData === 'error') {
                $scope.loadingMsg = 'Sorry, try again';
            }
            $scope.allRoutes = routeManager.getRoutesBaseInfo(routesData);
            $scope.loadingDone = true;
        }

        //draw map - streets, neighborhoodname, and pathes of all routes
        $scope.loadingMsg = 'Loading map now, please wait!';
        mapDrawer.loadBaseMap(setLoadingDone);
}]);
