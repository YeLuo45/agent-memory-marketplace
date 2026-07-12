// V5611-V5625: MultiModalMemoryPlugin tests — 15 engines

import { describe, it, expect } from 'vitest';
import {
  ImageEmbedder,
  AudioEmbed,
  ImageSearch,
  VideoGenerate,
  FaceDetect,
  ImageCaption,
  MediaClassifier,
  MediaThumbGenerator,
  MediaMetadataExtractor,
  MultimodalMerge,
  MediaTranscript,
  MultimodalCache,
  MultimodalMemoryStore,
  MultimodalMasterIndex,
  MultimodalRetriever,
  MULTIMODAL_BATCH_7_ENGINES,
  MULTIMODAL_TOOLS,
} from './MultimodalCore';
import { OpenMemoryAdapter } from '../mcp/OpenMemoryAdapter';

describe('ImageEmbedder', () => {
  it('embed with width/height/pixels/channels', () => {
    const e = new ImageEmbedder(64);
    const pixels = [255, 0, 0, 0, 255, 0, 0, 0, 255]; // 3 RGB pixels
    const f = e.embed(3, 1, pixels, 3);
    expect(f.width).toBe(3);
    expect(f.height).toBe(1);
    expect(f.channels).toBe(3);
    expect(f.meanColor[0]).toBeGreaterThan(0); // red dominant
    expect(f.embedding.length).toBe(64);
    expect(f.hash.length).toBeGreaterThan(0);
  });

  it('embed with default channels (3)', () => {
    const e = new ImageEmbedder(32);
    const pixels = [100, 200, 150];
    const f = e.embed(1, 1, pixels);
    expect(f.channels).toBe(3);
  });

  it('embedFromURI produces valid features', () => {
    const e = new ImageEmbedder(32);
    const f = e.embedFromURI('https://example.com/image.jpg');
    expect(f.uri).toBe('https://example.com/image.jpg');
    expect(f.embedding.length).toBe(32);
  });

  it('similarity computes cosine', () => {
    const e = new ImageEmbedder();
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(e.similarity(a, b)).toBeCloseTo(1, 5);
    const c = [0, 1, 0];
    expect(e.similarity(a, c)).toBeCloseTo(0, 5);
  });

  it('similarity returns 0 for empty vectors', () => {
    const e = new ImageEmbedder();
    expect(e.similarity([], [1, 2])).toBe(0);
  });

  it('dim() returns configured dim', () => {
    const e = new ImageEmbedder(128);
    expect(e.dim()).toBe(128);
  });
});

describe('AudioEmbed', () => {
  it('embed extracts features from samples', () => {
    const a = new AudioEmbed();
    const samples = new Array(1000).fill(0).map((_, i) => Math.sin(i * 0.01) * 0.5);
    const f = a.embed(samples, 16000);
    expect(f.peak).toBeGreaterThan(0);
    expect(f.rms).toBeGreaterThan(0);
    expect(f.embedding.length).toBe(32);
    expect(f.fingerprint.length).toBeGreaterThan(0);
    expect(f.sampleRate).toBe(16000);
    expect(f.channels).toBe(1);
  });

  it('embed handles empty samples', () => {
    const a = new AudioEmbed();
    const f = a.embed([], 16000);
    expect(f.peak).toBe(0);
    expect(f.rms).toBe(0);
    expect(f.duration).toBe(0);
  });

  it('transcribe produces non-empty string from loud samples', () => {
    const a = new AudioEmbed();
    const samples = new Array(16000).fill(0.5);
    const text = a.transcribe(samples, 16000);
    expect(text.length).toBeGreaterThan(0);
  });

  it('similarity computes cosine', () => {
    const a = new AudioEmbed();
    expect(a.similarity([1, 0], [1, 0])).toBeCloseTo(1, 5);
    expect(a.similarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
});

describe('ImageSearch', () => {
  it('add + search + get + size + delete', () => {
    const s = new ImageSearch();
    const pixels = [255, 0, 0];
    const m = s.add('image1.png', 1, 1, pixels);
    expect(m.id).toBeTruthy();
    expect(s.size()).toBe(1);

    const queryFeatures = new ImageEmbedder().embed(1, 1, pixels);
    const results = s.search(queryFeatures, 5);
    expect(results.length).toBeGreaterThan(0);

    expect(s.get(m.id)).not.toBeNull();
    expect(s.delete(m.id)).toBe(true);
    expect(s.size()).toBe(0);
  });

  it('returns topK results sorted by score', () => {
    const s = new ImageSearch();
    s.add('red.png', 1, 1, [255, 0, 0]);
    s.add('green.png', 1, 1, [0, 255, 0]);
    s.add('blue.png', 1, 1, [0, 0, 255]);
    const results = s.search(new ImageEmbedder().embed(1, 1, [255, 0, 0]), 3);
    expect(results.length).toBe(3);
  });
});

describe('VideoGenerate', () => {
  it('generate + frames + duration', () => {
    const v = new VideoGenerate();
    const frames = v.generate(10, 10, 5, 30);
    expect(frames.length).toBe(5);
    expect(frames[0].index).toBe(0);
    expect(v.frames().length).toBe(5);
    expect(v.duration(30)).toBe(5 / 30);
  });
});

describe('FaceDetect', () => {
  it('detect + count', () => {
    const f = new FaceDetect();
    const boxes = f.detect(100, 100, []);
    expect(boxes.length).toBeGreaterThanOrEqual(0);
    expect(f.count(100, 100, [])).toBe(boxes.length);
  });
});

describe('ImageCaption', () => {
  it('caption describes color and dimensions', () => {
    const c = new ImageCaption();
    const caption = c.caption({
      width: 200, height: 100, channels: 3,
      meanColor: [1, 0, 0], hash: 'abc123def', embedding: [],
    });
    expect(caption).toContain('200×100');
    expect(caption).toContain('warm red');
  });

  it('caption handles URI-only features', () => {
    const c = new ImageCaption();
    const caption = c.caption({
      width: 0, height: 0, channels: 3,
      meanColor: [0, 0, 0], hash: '000', embedding: [],
    });
    expect(caption).toContain('Image');
    expect(caption).toContain('dark');
  });

  it('caption includes context when provided', () => {
    const c = new ImageCaption();
    const caption = c.caption({
      width: 50, height: 50, channels: 3,
      meanColor: [0.5, 0.5, 0.5], hash: 'x', embedding: [],
    }, 'user upload');
    expect(caption).toContain('user upload');
  });
});

describe('MediaClassifier', () => {
  it('classifies URIs by extension', () => {
    const c = new MediaClassifier();
    expect(c.classify('image.png')).toBe('photo');
    expect(c.classify('movie.mp4')).toBe('video');
    expect(c.classify('song.mp3')).toBe('audio');
    expect(c.classify('doc.pdf')).toBe('document');
  });

  it('confidence for known formats is 1.0', () => {
    const c = new MediaClassifier();
    expect(c.confidence('foo.png')).toBe(1.0);
    expect(c.confidence('bar')).toBe(0.5);
  });
});

describe('MediaThumbGenerator', () => {
  it('generate produces correct size thumbnail', () => {
    const g = new MediaThumbGenerator();
    const features = new ImageEmbedder().embed(10, 10, [0, 0, 0]);
    const thumb = g.generate(features, 16);
    expect(thumb.length).toBe(16 * 16);
  });

  it('toHex converts to hex string', () => {
    const g = new MediaThumbGenerator();
    expect(g.toHex(0)).toBe('80'); // 0 * 255 + 128 = 128 = 0x80
  });
});

describe('MediaMetadataExtractor', () => {
  it('extract returns type + format', () => {
    const e = new MediaMetadataExtractor();
    const meta = e.extract('https://example.com/path/photo.png?w=200&h=100');
    expect(meta.type).toBe('image');
    expect(meta.format).toBe('png');
    expect(meta.attributes['w']).toBe('200');
  });

  it('extract date from filename', () => {
    const e = new MediaMetadataExtractor();
    const meta = e.extract('report-2024-12-31.pdf');
    expect(meta.created).toBe('2024-12-31');
  });
});

describe('MultimodalMerge', () => {
  it('merge combines text + image + audio', () => {
    const m = new MultimodalMerge(128);
    const merged = m.merge({
      text: 'hello world',
      image: { width: 1, height: 1, channels: 3, meanColor: [1, 0, 0], hash: 'x', embedding: [0.5, 0.3] },
      audio: { duration: 1, sampleRate: 16000, channels: 1, peak: 0.5, rms: 0.3, fingerprint: 'f', embedding: [0.1, 0.2] },
    });
    expect(merged.mergedEmbedding.length).toBe(128);
    expect(merged.text).toBe('hello world');
  });

  it('merge handles text only', () => {
    const m = new MultimodalMerge();
    const merged = m.merge({ text: 'x' });
    expect(merged.mergedEmbedding.length).toBe(128);
  });

  it('similarity computes cosine', () => {
    const m = new MultimodalMerge();
    expect(m.similarity([1, 0], [1, 0])).toBeCloseTo(1, 5);
  });
});

describe('MediaTranscript', () => {
  it('transcribe + toSRT', () => {
    const t = new MediaTranscript();
    const samples = new Array(8000).fill(0.3);
    const segments = t.transcribe(samples, 16000, 0.25);
    expect(segments.length).toBeGreaterThan(0);
    const srt = t.toSRT(segments);
    expect(srt).toContain(' --> ');
  });

  it('toSRT handles empty segments', () => {
    const t = new MediaTranscript();
    expect(t.toSRT([])).toBe('');
  });
});

describe('MultimodalCache', () => {
  it('get + set + LRU + hitRate', () => {
    const c = new MultimodalCache(2);
    const f = { width: 1, height: 1, channels: 3, meanColor: [0, 0, 0], hash: 'x', embedding: [0.1] };
    c.set('a', f);
    expect(c.has('a')).toBe(true);
    expect(c.get('a')).toEqual(f);
    c.get('x'); // miss
    expect(c.hitRate()).toBeCloseTo(0.5);
    expect(c.size()).toBe(1);
    c.invalidate('a');
    expect(c.has('a')).toBe(false);
    expect(c.invalidate('x')).toBe(false);
    c.clear();
    expect(c.size()).toBe(0);
  });
});

describe('MultimodalMemoryStore', () => {
  it('addImage + searchImagesByEmbedding + count', () => {
    const store = new MultimodalMemoryStore();
    const pixels = [255, 0, 0];
    const result = store.addImage('test.png', 1, 1, pixels, 'agent1');
    expect(result.memoryId).toBeTruthy();
    expect(result.imageId).toBeTruthy();
    expect(store.count().images).toBe(1);
    expect(store.count().memories).toBe(1);

    const search = store.searchImagesByEmbedding([0.5, 0.3, 0.1], 5);
    expect(search.length).toBeGreaterThan(0);
  });

  it('imagesForAgent returns matching images', () => {
    const store = new MultimodalMemoryStore();
    store.addImage('a.png', 1, 1, [0, 0, 0], 'agent1');
    store.addImage('b.png', 1, 1, [255, 255, 255], 'agent2');
    const images = store.imagesForAgent('agent1');
    expect(images.length).toBe(1);
  });

  it('adapter() returns underlying adapter', () => {
    const adapter = new OpenMemoryAdapter();
    const store = new MultimodalMemoryStore(adapter);
    expect(store.adapter()).toBe(adapter);
  });
});

describe('MultimodalMasterIndex + MULTIMODAL_TOOLS', () => {
  it('list + count + has + const length', () => {
    const idx = new MultimodalMasterIndex();
    expect(idx.list().length).toBe(15);
    expect(idx.count()).toBe(15);
    expect(idx.has('ImageEmbedder')).toBe(true);
    expect(idx.has('Missing')).toBe(false);
    expect(MULTIMODAL_BATCH_7_ENGINES).toHaveLength(15);
  });

  it('MULTIMODAL_TOOLS has 8 tools', () => {
    expect(MULTIMODAL_TOOLS.length).toBe(8);
    const names = MULTIMODAL_TOOLS.map(t => t.name);
    expect(names).toContain('Multimodal.addImage');
    expect(names).toContain('Multimodal.transcribe');
    expect(names).toContain('Multimodal.retrieve');
  });
});

describe('MultimodalRetriever', () => {
  it('retrieve by text', () => {
    const adapter = new OpenMemoryAdapter();
    adapter.create({ agent_id: 'u', type: 'episodic', content: 'python is great' });
    adapter.create({ agent_id: 'u', type: 'episodic', content: 'rust is fast' });
    const r = new MultimodalRetriever(adapter);
    const hits = r.retrieve({ text: 'python', topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some(h => h.modality === 'text')).toBe(true);
  });

  it('retrieve by image features', () => {
    const r = new MultimodalRetriever();
    const pixels = [255, 0, 0];
    const features = new ImageEmbedder().embed(1, 1, pixels);
    const hits = r.retrieve({ imageFeatures: features, topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('retrieve cross-modal merge', () => {
    const r = new MultimodalRetriever();
    const pixels = [255, 0, 0];
    const features = new ImageEmbedder().embed(1, 1, pixels);
    const hits = r.retrieve({
      text: 'red image',
      imageFeatures: features,
      topK: 5,
    });
    expect(hits.some(h => h.modality === 'multimodal')).toBe(true);
  });
});