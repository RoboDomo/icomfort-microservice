# icomfort-microservice
microservice for iComfort S30 thermostat (4 zone)

This microservice contacts the lennox servers in the cloud to poll for zone status and to send temperature settings.

## TODO:
* Turn system on/off
* Change system mode (e.g. heat/cool)
* Change various system settings

## REQUIRED:

The following ENV variables must be set:
* LENNOX_USER = username to log into lennoxicomfort.com WWW site.
* LENNOX_PASSWORD = password for the lennoxicomfort.com WWW site.
* LENNOX_HOMEID = lennoxicomfort.com homeid (see below)
* LENNOX_LCCID = lennoxicomfort.com lccid (see below)

The LENNOX_HOMEID and LENNOX_LCCID values can be iobtained by looking at your address bar when looking at the 
https://lennoxicomfort.com/Dashboard/HomeDetails page.  The home id looks like a deciimal 6 digit number.  The
LCCID looks like a UUID - a long string of hex digits with hyphens separating blocks of the digits.

## Notes
Lennox does not publish an API for the S30 series.  I could not find an unofficial one anywhere, either.  Simply looking
at the network tab in Chrome while logging in and accessing various features of the lennoxicomfort.com WWW site exposed enough
of an API to make this microservice work.  

This microservice assumes 4 zones.  Each one is monitored individually.  For each zone, there is a separate login and browser-like session maintained.  Thus if there is some sort of error, only one zone must go through the login process again while the others continue to poll and respond to zone changes (heat/cold target temperatures).  Reconnection is automatic.




