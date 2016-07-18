# SF Muni Tracker

This web app shows the locations of SF Muni vehicles.
This site uses [Next Bus API](http://www.nextbus.com/xmlFeedDocs/NextBusXMLFeed.pdf) to retrieve real time location of SF Muni vehicles.

## How to Use

See the demonstration at [http://tany.kim/sf-muni](http://tany.kim/sf-muni).

* Select up to 5 routes of Muni (It is hard to investigate more than 5 routes at the same time)
* Toggle each direction of each route.
* Remove selected routes in the list.

The site retrieves the real time locatin of vehicles of the selected routes every 15 minutes. 

The vehicles are not expected to be in a different position all the time. Those updated ones are highlighted with animation on the map, as well as updated numbers in the route list.

## About the Code
### Setup Grunt

```
npm install
```

### Install libraries

```
bower install
```

### Development

Run `grunt serve` for preview.

### Create CSS

```
lessc less/main.less app/styles/main.css
```

### Deployment

Folder "app" is ready for deployment.

### Notes

This project was generated with [yo angular generator](https://github.com/yeoman/generator-angular) version 0.14.0, then modfied.

## TO-DOs

* User interaction on the map - over stops and vehicles
* Reduce route.json size
* Separate routeJsonGenerator
* Bootstrap touch interaction