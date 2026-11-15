const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

export function parseIsoDuration(iso) {
  if (!iso || typeof iso !== 'string') return { seconds: 600, label: '10:00' };
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { seconds: 600, label: '10:00' };
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const pad = (n) => String(n).padStart(2, '0');
  const label = hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
  return { seconds: totalSeconds || 60, label };
}

async function fetchYoutubeJson(endpoint, params) {
  const url = new URL(`${YT_API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const ytReason = data?.error?.errors?.[0]?.reason || '';
        const ytMessage = data?.error?.message || `YouTube API returned status ${response.status}`;
        if (response.status === 400 || ytReason === 'keyInvalid') {
          const err = new Error('Invalid YouTube Data API v3 key. Please verify your API credentials.');
          err.code = 'INVALID_API_KEY';
          throw err;
        }
        if (response.status === 403 && (ytReason.includes('quota') || ytMessage.toLowerCase().includes('quota'))) {
          const err = new Error('YouTube API quota limit exceeded. Please retry later or use another authorized key.');
          err.code = 'QUOTA_EXCEEDED';
          throw err;
        }
        if (response.status === 403) {
          const err = new Error(`YouTube API access denied: ${ytMessage}`);
          err.code = 'ACCESS_DENIED';
          throw err;
        }
        const err = new Error(ytMessage);
        err.code = 'YOUTUBE_API_ERROR';
        throw err;
      }
      return data;
    } catch (err) {
      lastError = err;
      if (err.code === 'INVALID_API_KEY' || err.code === 'QUOTA_EXCEEDED' || err.code === 'ACCESS_DENIED') {
        throw err;
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }
  }
  throw lastError || new Error('Failed to communicate with YouTube Data API v3.');
}

export async function validateAndFetchChannel(apiKey, channelId) {
  const cleanKey = String(apiKey || '').trim();
  const cleanChannelId = String(channelId || '').trim();

  if (!cleanKey) {
    const err = new Error('YouTube Data API v3 Key is required.');
    err.code = 'MISSING_KEY';
    throw err;
  }
  if (!cleanChannelId) {
    const err = new Error('YouTube Channel ID is required (e.g., UC...).');
    err.code = 'MISSING_CHANNEL';
    throw err;
  }

  const data = await fetchYoutubeJson('channels', {
    part: 'snippet,contentDetails,status,statistics',
    id: cleanChannelId,
    key: cleanKey,
  });

  if (!data.items || data.items.length === 0) {
    const err = new Error('Channel ID not found or inaccessible. Please check the Channel ID.');
    err.code = 'CHANNEL_NOT_FOUND';
    throw err;
  }

  const ch = data.items[0];
  const uploadsPlaylistId = ch?.contentDetails?.relatedPlaylists?.uploads || '';
  if (!uploadsPlaylistId) {
    const err = new Error('This channel does not expose an uploads playlist.');
    err.code = 'NO_UPLOADS_PLAYLIST';
    throw err;
  }

  const thumbs = ch?.snippet?.thumbnails || {};
  const suggestedThumbnail = thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || '';

  return {
    channelId: ch.id,
    uploadsPlaylistId,
    suggestedThumbnail,
    videoCount: Number(ch?.statistics?.videoCount || 0),
    privacyStatus: ch?.status?.privacyStatus || 'public',
  };
}

export async function fetchChannelVideos(apiKey, channelId, { maxResults = 25, pageToken = '' } = {}) {
  const channel = await validateAndFetchChannel(apiKey, channelId);

  const playlistData = await fetchYoutubeJson('playlistItems', {
    part: 'snippet,contentDetails,status',
    playlistId: channel.uploadsPlaylistId,
    maxResults: Math.min(Math.max(Number(maxResults) || 25, 1), 50),
    pageToken: pageToken || undefined,
    key: apiKey.trim(),
  });

  const items = playlistData.items || [];
  if (items.length === 0) {
    return {
      channel,
      videos: [],
      nextPageToken: null,
      totalResults: 0,
    };
  }

  const videoIds = items
    .map((it) => it?.contentDetails?.videoId || it?.snippet?.resourceId?.videoId)
    .filter(Boolean);

  const detailsMap = new Map();
  if (videoIds.length > 0) {
    const detailData = await fetchYoutubeJson('videos', {
      part: 'snippet,contentDetails,status',
      id: videoIds.join(','),
      key: apiKey.trim(),
    });
    for (const v of detailData.items || []) {
      detailsMap.set(v.id, v);
    }
  }

  const videos = [];
  for (const item of items) {
    const vid = item?.contentDetails?.videoId || item?.snippet?.resourceId?.videoId;
    if (!vid) continue;
    const detail = detailsMap.get(vid);
    if (!detail) {
      videos.push({
        youtubeVideoId: vid,
        title: item?.snippet?.title || 'Unavailable Video',
        description: '',
        thumbnailUrl: '',
        publishedAt: item?.snippet?.publishedAt || new Date().toISOString(),
        durationSeconds: 0,
        durationLabel: '0:00',
        availabilityStatus: 'Unavailable',
        eligible: false,
        reason: 'Video deleted or private',
      });
      continue;
    }

    const privacy = detail?.status?.privacyStatus || 'private';
    const embeddable = detail?.status?.embeddable !== false;
    const uploadStatus = detail?.status?.uploadStatus || 'processed';
    const eligible = privacy === 'public' && embeddable && uploadStatus === 'processed';

    const thumbs = detail?.snippet?.thumbnails || {};
    const thumbnailUrl = thumbs.maxres?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || '';
    const { seconds, label } = parseIsoDuration(detail?.contentDetails?.duration);

    videos.push({
      youtubeVideoId: vid,
      title: detail?.snippet?.title || 'Untitled Lesson',
      description: detail?.snippet?.description || '',
      thumbnailUrl,
      publishedAt: detail?.snippet?.publishedAt || new Date().toISOString(),
      durationSeconds: seconds,
      durationLabel: label,
      availabilityStatus: eligible ? 'Available' : 'Restricted',
      eligible,
      reason: eligible ? '' : (!embeddable ? 'Embedding disabled by rights holder' : `Privacy status: ${privacy}`),
    });
  }

  return {
    channel,
    videos,
    nextPageToken: playlistData.nextPageToken || null,
    totalResults: Number(playlistData?.pageInfo?.totalResults || videos.length),
  };
}
