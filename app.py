import pandas as pd
from pysqlcipher3 import dbapi2 as sqlite
import appdirs
from os import path
import json
import os
import eel

eel.init('web')


@eel.expose
def get_last_log():

    output_dir = os.path.expanduser('~') + '/unbox_output/'
    last_log = pd.read_csv(
        output_dir + 'rekordbox_stream.txt', header=None, sep='-')
    if len(last_log.columns) == 1:
        return last_log[0].tolist()[0]
    return last_log[0].tolist()[0] + ' - ' + last_log[1].tolist()[0]


def run():
    while True:

        query = ''' select 
                    h.created_at, 
                    c.Title as Track, 
                    a.Name as Artist
                    from djmdSongHistory as h
                    join djmdContent as c on h.ContentID = c.ID
                    left join djmdArtist as a on c.ArtistID = a.ID
                    order by h.created_at desc
                    limit 2;
                '''

        if os.name == 'nt':
            options_file = appdirs.user_data_dir(
                'rekordboxAgent', 'Pioneer', roaming=True) + '\\storage\\options.json'
        else:
            options_file = os.path.expanduser(
                '~/Library/Application Support/') + 'Pioneer/rekordboxAgent/storage/options.json'
        with open(options_file) as f:
            options = json.loads(f.read())

        db_path = options['options'][0][1]

        conn = sqlite.connect(db_path)
        c = conn.cursor()
        c.execute(# This is where the db is decrypted)
        tracks = pd.read_sql(query, conn)
        c.close()

        output_dir = os.path.expanduser('~') + '/unbox_output/'
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        if path.exists(output_dir + "last_checked.txt"):
            last_checked = pd.read_csv(
                output_dir + 'last_checked.txt').created_at.tolist()[0]
            tracks_to_append = tracks[(tracks.created_at > last_checked) & (
                tracks.created_at.notnull())][['Artist', 'Track', 'created_at']]
        else:
            tracks_to_append = tracks[['Artist', 'Track', 'created_at']]

        if not tracks_to_append.empty:

            most_recent_tracktime = tracks_to_append[tracks_to_append.created_at == tracks_to_append.created_at.max()][[
                'created_at']]

            artist_track_df = tracks_to_append[['Artist', 'Track']]

            print('Adding tracks: {}'.format(artist_track_df.to_string()))
            artist_track_df.to_csv(
                output_dir + 'rekordbox_stream.txt', sep='-', index=False,
                header=False, mode='w')

            most_recent_tracktime.to_csv(
                output_dir + 'last_checked.txt', index=False)

        eel.sleep(10.0)


eel.spawn(run)

eel.start('main.html', size=(500, 300))

while True:
    eel.sleep(1.0)
