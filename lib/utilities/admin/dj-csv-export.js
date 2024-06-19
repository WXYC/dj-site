/**
 * @description Exports an array of DJs as a CSV file.
 * @param {Array<import("@/lib/redux").DJ>} djs 
 * @param {string} title 
 */
const exportDJsAsCSV = (djs, title="djs") => {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Name,Username,DJ Name,Shows,Admin\n';
    djs.forEach((dj) => {
        csv += `${dj.realName},${dj.userName},${dj.djName},${dj.shows},${dj.isAdmin}\n`;
    });
    var encodedUri = encodeURI(csv);
    var link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('style', 'display: none;');
    link.setAttribute('download', `${title}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export default exportDJsAsCSV;