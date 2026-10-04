import { createMediaPlayer } from './player.js';
import { createSoundRecorder } from './recorder.js';
import { createMovieMaker } from './moviemaker.js';
export function registerMedia(registry) {
  for (const app of [
    {
      id: 'media-player',
      title: 'Windows Media Player',
      icon: 'media',
      category: 'Programs',
      commands: ['wmplayer', 'wmplayer.exe', 'mplayer2', 'mplayer2.exe'],
      extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'mp4', 'webm', 'ogv'],
      create: createMediaPlayer,
    },
    {
      id: 'sound-recorder',
      title: 'Sound Recorder',
      icon: 'sound',
      category: 'Entertainment',
      commands: ['sndrec32', 'sndrec32.exe'],
      create: createSoundRecorder,
    },
    {
      id: 'moviemaker',
      title: 'Windows Movie Maker',
      icon: 'movie',
      category: 'Accessories',
      commands: ['moviemk', 'moviemk.exe'],
      extensions: ['mswmm'],
      create: createMovieMaker,
    },
  ])
    registry.register(app);
}
