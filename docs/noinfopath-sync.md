# noinfopath-sync
@version 2.0.34

## Overview
Provides data synchronization services.

## @class NoSyncData

TODO: Add description.

#### String lastSync (read only)

##### getter
Returns the amount of time that has past since the last sync event.

#### Boolean needChanges (read only)

##### getter
Return true if the `previousVersion` is greater than zero, and `version`
is greater than `previousVersion`.

#### Obect previousVersion (read only)

##### getter
Return the pervious version update information, if any.
Otherwise returns `null`

#### Object version (read/write)

##### getter
returns the current version object used for requesting data from DTCS.

##### setter
Set the `previousVersion` to the current `version`, then sets
current 'version' to the assignment value.  Finally, sets the
`pending` property to true.


#### Boolean (read/write)

##### getter
Returns the current pending state.


#### clearPending()

Set the pending state to false.

#### String toJSON()

Return a pure javascript object suitable for persistence in localStorage.

#### Static NoSyncData fromJSON(data)

Returns a new NoSyncData intances hydrated with the provide pure javascript object.

