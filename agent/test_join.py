"""One-off manual test: join a LiveKit room as the 'patient' and report whether
the reminder agent publishes an audio track and/or sends transcript text.
Usage: python test_join.py <livekit_url> <access_token>
"""

import asyncio
import sys

from livekit import rtc


async def main(url: str, token: str):
    room = rtc.Room()

    @room.on("participant_connected")
    def on_participant(participant: rtc.RemoteParticipant):
        print(f"[event] participant_connected: {participant.identity}")

    @room.on("track_subscribed")
    def on_track(track: rtc.Track, publication, participant):
        print(f"[event] track_subscribed: kind={track.kind} from={participant.identity}")

    @room.on("data_received")
    def on_data(data_packet: rtc.DataPacket):
        print(f"[event] data_received: {data_packet.data[:200]!r}")

    @room.on("disconnected")
    def on_disconnected(reason=None):
        print(f"[event] disconnected: {reason}")

    await room.connect(url, token)
    print(f"[connected] room={room.name} local_identity={room.local_participant.identity}")
    print(f"[state] remote participants at join: {list(room.remote_participants.keys())}")

    await asyncio.sleep(25)
    await room.disconnect()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2]))
