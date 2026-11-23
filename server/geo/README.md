# Place names (offline)

`places.bin` lets the server turn the GPS position of a photo into a city, state and country without sending the
position anywhere. It lists about 237,000 places with 500 or more inhabitants and is read by `src/geocode.js`.

The data comes from [GeoNames](https://www.geonames.org) (`cities500`, `admin1CodesASCII`, `countryInfo`), which is
licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Please keep this credit
when you share the file.

To rebuild it (for example from a newer GeoNames export), download the three files from
<https://download.geonames.org/export/dump/>, unzip `cities500.zip`, and run from the `server` folder:

```
node scripts/build-places.mjs <folder with cities500.txt, admin1CodesASCII.txt and countryInfo.txt>
```

A photo gets the nearest listed place within 100 km; farther away (open sea, polar regions) it gets none. The nearest
place can be in another state when a photo was taken near a border or in a village the list does not contain.
