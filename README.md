# Birdhouse

Generate language maps from Twitter data.

# Configuration

First, create a Twitter app. Then, copy `.env.sample` as `.env` and add configure the parameters accordingly.

## Quick start

```sh
npm install
```

The process of generating maps consists of three main parts: [collect](#collecting-tweets), [process](#processing-the-data), and [draw](#generating-maps).

Make sure you have MongoDB running and everything properly configured (see [previous section](#configuration)) and run

```sh
# Collect tweets first.
# Let this run for some time.
# I would recommend to collect at least 1M tweets,
# which takes a few hours.
# You can stop and continue at any time,
# the new data will be added to the old one.

npm run collect

# Process the data for our convencience.
# Better start this only after the previous step is finished.

npm run process

# Finally! Draw a map with the processed data.

npm run draw

```

## Collecting tweets

## Processing the data

## Generating maps
