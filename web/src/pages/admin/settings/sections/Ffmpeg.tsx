import { SchemaFields, type Field } from '../SchemaFields';

const opt = (...values: string[]) => values.map((v) => ({ value: v, label: v }));

const fields: Field[] = [
  { path: 'ffmpeg.crf', type: 'number', label: 'Constant quality (CRF)', help: 'Lower is better quality and bigger files. 23 is a good default.', min: 0, max: 51 },
  { path: 'ffmpeg.threads', type: 'number', label: 'Threads', help: '0 uses all cores.', min: 0 },
  { path: 'ffmpeg.preset', type: 'select', label: 'Preset', help: 'Slower presets give smaller files.', options: opt('ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow') },
  { path: 'ffmpeg.targetVideoCodec', type: 'select', label: 'Video codec', options: opt('h264', 'hevc', 'vp9', 'av1') },
  { path: 'ffmpeg.acceptedVideoCodecs', type: 'multi', label: 'Accepted video codecs', options: ['h264', 'hevc', 'vp9', 'av1'] },
  { path: 'ffmpeg.targetAudioCodec', type: 'select', label: 'Audio codec', options: opt('aac', 'mp3', 'libopus', 'pcm_s16le') },
  { path: 'ffmpeg.acceptedAudioCodecs', type: 'multi', label: 'Accepted audio codecs', options: ['aac', 'mp3', 'libopus', 'pcm_s16le'] },
  { path: 'ffmpeg.acceptedContainers', type: 'multi', label: 'Accepted containers', options: ['mov', 'ogg', 'webm'] },
  { path: 'ffmpeg.targetResolution', type: 'select', label: 'Target resolution', options: opt('2160', '1440', '1080', '720', '480', 'original') },
  { path: 'ffmpeg.maxBitrate', type: 'text', label: 'Maximum bitrate', help: 'For example 5000k. 0 means no limit.' },
  { path: 'ffmpeg.bframes', type: 'number', label: 'B-frames', help: '-1 lets ffmpeg decide.', min: -1, max: 16 },
  { path: 'ffmpeg.refs', type: 'number', label: 'Reference frames', min: 0, max: 6 },
  { path: 'ffmpeg.gopSize', type: 'number', label: 'Keyframe interval', min: 0 },
  { path: 'ffmpeg.twoPass', type: 'switch', label: 'Two-pass encoding' },
  { path: 'ffmpeg.transcode', type: 'select', label: 'Transcoding policy', options: opt('required', 'optimal', 'bitrate', 'all', 'disabled') },
  { path: 'ffmpeg.tonemap', type: 'select', label: 'Tone-mapping', options: opt('hable', 'mobius', 'reinhard', 'disabled') },
  { path: 'ffmpeg.accel', type: 'select', label: 'Hardware acceleration', options: opt('disabled', 'nvenc', 'qsv', 'vaapi', 'rkmpp') },
  { path: 'ffmpeg.accelDecode', type: 'switch', label: 'Hardware decoding', when: (c) => c.ffmpeg?.accel !== 'disabled' },
  { path: 'ffmpeg.preferredHwDevice', type: 'text', label: 'Preferred hardware device', help: 'For example /dev/dri/renderD128, or "auto".', when: (c) => c.ffmpeg?.accel !== 'disabled' },
  { path: 'ffmpeg.realtime.enabled', type: 'switch', label: 'Real-time transcoding', help: 'Convert videos while they play.' },
];

export default function Ffmpeg() {
  return <SchemaFields fields={fields} />;
}
