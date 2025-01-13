import { User } from "@/lib/models";

export const exportDJsAsCSV = (djs: User[], title="djs") => {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Name,Username,DJ Name,Email,Authority (1 = None, 2 = Music Director, 3 = Station Manager)\n';
    djs.forEach((dj) => {
        csv += `${dj.name},${dj.username},${dj.djName},${dj.email},${dj.authority}\n`;
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