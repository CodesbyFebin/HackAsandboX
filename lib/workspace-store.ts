// Atomic statements are shared with the SQLite integration tests.
export const INSERT_RECORD = `INSERT INTO records (id,owner,kind,body,created,deleted)
SELECT ?,?,?,?,?,NULL
WHERE (SELECT count(*) FROM records WHERE owner=? AND deleted IS NULL)<150
AND (? != 'project' OR (SELECT count(*) FROM records WHERE owner=? AND kind='project' AND deleted IS NULL)<10)
AND (? != 'reservation' OR NOT EXISTS (SELECT 1 FROM records WHERE owner=? AND kind='reservation' AND deleted IS NULL))
AND (? != 'saved' OR NOT EXISTS (SELECT 1 FROM records WHERE owner=? AND kind='saved' AND deleted IS NULL AND json_extract(body,'$.eventId')=?))
RETURNING id`;
export const RESTORE_RECORD = `UPDATE records SET deleted=NULL
WHERE id=? AND owner=? AND deleted IS NOT NULL
AND (SELECT count(*) FROM records WHERE owner=? AND deleted IS NULL)<150
AND (kind!='project' OR (SELECT count(*) FROM records WHERE owner=? AND kind='project' AND deleted IS NULL)<10)
AND (kind!='reservation' OR NOT EXISTS (SELECT 1 FROM records WHERE owner=? AND kind='reservation' AND deleted IS NULL))
AND (kind!='saved' OR NOT EXISTS (SELECT 1 FROM records other WHERE other.owner=? AND other.kind='saved' AND other.deleted IS NULL AND json_extract(other.body,'$.eventId')=json_extract(records.body,'$.eventId')))
RETURNING id`;
export const SOFT_DELETE_RECORD = `UPDATE records SET deleted=? WHERE id=? AND owner=? AND deleted IS NULL RETURNING id`;
export const UPDATE_RECORD = `UPDATE records SET body=? WHERE id=? AND owner=? AND kind=? AND deleted IS NULL RETURNING id`;
