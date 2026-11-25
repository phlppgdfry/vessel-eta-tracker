// Public, read-only AIS relay. Credentials and subscriptions never come from clients.
const AIS_URL = 'wss://stream.aisstream.io/v0/stream';
const BOUNDS = [[50.8, 1.5], [52.2, 4.8]];
const TYPES = ['PositionReport', 'StandardClassBPositionReport', 'ShipStaticData'];
const text = value => String(value ?? '').replace(/[<>&"'`]/g, ' ').trim().slice(0, 100);

function publicMessage(raw) {
  const msg = JSON.parse(String(raw));
  const meta = msg.MetaData || msg.Metadata;
  const type = msg.MessageType;
  const body = msg.Message?.[type];
  if (!meta || !body || !TYPES.includes(type)) return null;
  const mmsi = String(meta.MMSI);
  const lat = meta.latitude ?? meta.Latitude, lon = meta.longitude ?? meta.Longitude;
  if (!/^\d{9}$/.test(mmsi) || !Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < BOUNDS[0][0] || lat > BOUNDS[1][0] || lon < BOUNDS[0][1] || lon > BOUNDS[1][1]) return null;
  const position = type !== 'ShipStaticData';
  const fields = position
    ? { Sog: Number.isFinite(body.Sog) && body.Sog >= 0 && body.Sog < 102.3 ? body.Sog : 0,
        Cog: Number.isFinite(body.Cog) && body.Cog >= 0 && body.Cog < 360 ? body.Cog : null }
    : { Name: text(body.Name), Destination: text(body.Destination),
        Type: Number.isInteger(body.Type) && body.Type >= 0 && body.Type <= 99 ? body.Type : 0 };
  return { MessageType: type, MetaData: { MMSI: Number(mmsi), ShipName: text(meta.ShipName),
    latitude: lat, longitude: lon, time_utc: text(meta.time_utc) }, Message: { [type]: fields } };
}

module.exports = { publicMessage, AIS_URL, BOUNDS, TYPES };
