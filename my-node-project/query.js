var sql = 'SELECT * FROM STUDENT_ENROLEMENT ;'

var sid = '1000'
var mid = '101'
var newvalue = '120'

let update = 'UPDATE STUDENT_ENROLEMENT SET MID =' + newvalue + ' WHERE SID =' + sid + ' AND MID =' + mid + ';'

module.exports = {
    sql,
    update
};
