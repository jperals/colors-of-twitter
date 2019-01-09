# TLMG

> Twitter Language Map Generator

This is a set of scripts that generate language maps out of Twitter data.

![Sample image](./sample.png)

Nor the maps nor the data themselves are provided here, the idea is that you can generate them yourself with the instructions below.

## Initial setup

- Create a Twitter app: https://developer.twitter.com/apps

- Have a MongoDB instance running

- Copy `.env.sample` as `.env` and add configure the parameters accordingly

- Run `npm install`

## Collecting data

First you will need some data. Let this run for a while:

```sh
npm run collect
```

This will be collecting and analysing around 1,000 tweets per minute, adding the results to the database collection determined by your environment variables `DATABASE_URL`, `DATABASE_NAME` and `COLLECTION_LOCATIONS`.

Of course, the more tweets you get, the better. You can speed things up a bit (up to 3,000 tweets per minute) by decreasing the environment variable `MIN_TWEET_LENGTH`, at the expense of the reliability of the language detection.

You can kill the process and resume later, the new data will just be aggregated to the old one. This can also be run on a remote setup like Heroku + mLab so that it's running continuously without intervention.

You can run `npm run stats` at any point to get some statistics.

## Generating maps

### As PNG

```sh
npm run png
```

You can pass some optional parameters to define the image width in pixels (otherwise the value from the `WIDTH` environment variable will be taken) and/or a longitude/latitude bounding box:

```sh
npm run png -- --width=1000 --box=-27,72,45,34
```

Aliases for the bounding box can also be set in [./src/app/bounding-boxes.json](./src/app/bounding-boxes.json):

```sh
npm run png -- --width=1000 --box=europe
```

### As GeoJSON

This will generate a GeoJSON map that can be shown with mapping tools like LeafletJS or Mapbox. It's a more sophisticated approach that requires heavier geometric calculations and can take quite longer:

```sh
npm run geojson
```

## Artificially limiting language boundaries

If you want to manually fine tune your maps, one way to do it is to apply boundaries to languages. You can do that by adding the corresponding GeoJSON file under [./src/app/fences](./src/app/fences).

An easy way yo do it is to draw the corresponding shapes using a service like `geojson.io` and copy-paste the result to a JSON file named after the language code, just like the existing `en.json` file that you can see.

I am applying this technique to the English language to compensate that it's used so much on the Internet; but personally I have preferred to not go further with this in other languages, as this could get really tricky really quickly.

You can bypass this feature altogether when generating PNG maps by passing a `--raw` parameter:

```sh
npm run png -- --raw
``` 
