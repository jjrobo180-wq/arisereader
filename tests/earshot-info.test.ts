// Pod+ "About this podcast": the feed's channel read right, and chart ranks matched by name across platforms.
import test from "node:test";
import assert from "node:assert/strict";
import { findRank, nameKey, parseChannel, parseSpotifyChart } from "../server/podcastInfo";

test("channel: description, site, hosts and categories from before the first episode", () => {
  const xml = `<rss><channel><title>Show</title><link>https://show.example</link>
    <description><![CDATA[<p>Big ideas &amp; small talk.</p>]]></description>
    <itunes:owner><itunes:name>Owner Co</itunes:name></itunes:owner>
    <podcast:person role="host">Ana Ruiz</podcast:person><podcast:person role="guest">Not Me</podcast:person>
    <itunes:category text="Society &amp; Culture"/>
    <item><description>episode text</description><itunes:category text="Nope"/></item></channel></rss>`;
  const c = parseChannel(xml);
  assert.equal(c.about, "Big ideas & small talk.");
  assert.equal(c.website, "https://show.example");
  assert.deepEqual(c.hosts, ["Ana Ruiz"]);
  assert.deepEqual(c.categories, ["Society & Culture"]);
  assert.deepEqual(parseChannel("<channel><itunes:owner><itunes:name>Solo</itunes:name></itunes:owner></channel>").hosts, ["Solo"], "owner when no hosts are listed");
  assert.equal(parseChannel("").about, "");
});

test("chart ranks: matched by name, publisher breaks ties, missing is 0", () => {
  const list = parseSpotifyChart([{ showName: "The Daily", showPublisher: "NYT", showUri: "spotify:show:a" }, { showName: "Huberman Lab", showPublisher: "Scicomm" }, { junk: 1 }]);
  assert.equal(list.length, 2);
  assert.equal(findRank(list, "Daily"), 1, "a leading The doesn't matter");
  assert.equal(findRank(list, "huberman lab"), 2);
  assert.equal(findRank(list, "Nobody"), 0);
  const twins = [{ name: "Up First", publisher: "Other" }, { name: "Up First", publisher: "NPR" }];
  assert.equal(findRank(twins, "Up First", "NPR"), 2);
  assert.equal(nameKey("Smartless & Friends"), "smartlessandfriends");
  assert.deepEqual(parseSpotifyChart(null), []);
});
