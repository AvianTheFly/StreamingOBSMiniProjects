-- Native OBS shuffle: choose the next file only after the entire stinger finishes.
-- Never change scene contents, faders, scene overrides or another transition.
obs = obslua
local target = 'Hub Spirit Transitions'
local directory = 'C:/StreamingMedia/Transitions/udyr-spirits-v2'
local cut_ms, tail_guard = 4000, 6.85
local enabled = true
local bag, last, pending, deadline = {}, '', false, 0
local choices = {'bear', 'turtle', 'ram', 'phoenix'}
local loaded = false
local attached, signal_handler = nil, nil

local function now() return obs.os_gettime_ns() / 1000000000 end
local function exists(path)
    local file = io.open(path, 'rb')
    if not file then return false end
    file:close(); return true
end

local function with_target(callback)
    local sources = obs.obs_frontend_get_transitions()
    local found = false
    if sources then
        for _, source in ipairs(sources) do
            if obs.obs_source_get_name(source) == target and
               obs.obs_source_get_id(source) == 'obs_stinger_transition' then
                callback(source); found = true; break
            end
        end
        obs.source_list_release(sources)
    end
    return found
end

local function selected()
    local source = obs.obs_frontend_get_current_transition()
    if not source then return false end
    local result = obs.obs_source_get_name(source) == target
    obs.obs_source_release(source)
    return result
end

local function refill()
    bag = {}
    for _, id in ipairs(choices) do
        if exists(directory .. '/' .. id .. '.webm') then table.insert(bag, id) end
    end
    for i = #bag, 2, -1 do
        local j = math.random(i); bag[i], bag[j] = bag[j], bag[i]
    end
    if #bag > 1 and bag[#bag] == last then
        bag[1], bag[#bag] = bag[#bag], bag[1]
    end
end

local function load_timing()
    local file = io.open(directory .. '/manifest.json', 'rb')
    if not file then return end
    local text = file:read('*all'); file:close()
    local data = obs.obs_data_create_from_json(text)
    if not data then return end
    local cut = obs.obs_data_get_int(data, 'cut_ms')
    local guard = obs.obs_data_get_int(data, 'tail_guard_ms')
    local duration = obs.obs_data_get_double(data, 'duration')
    if duration > 0 and cut > 0 and cut < duration * 1000 and guard >= duration * 1000 then
        cut_ms, tail_guard = cut, guard / 1000
    end
    obs.obs_data_release(data)
end

local function queue_next()
    if not enabled then return end
    with_target(function(source)
        local t = obs.obs_transition_get_time(source)
        if t > 0 and t < 1 then return end
        if #bag == 0 then refill() end
        if #bag == 0 then
            obs.script_log(obs.LOG_WARNING, 'Spirit videos missing from ' .. directory)
            return
        end
        local id = table.remove(bag)
        -- Recheck before changing playback: a missing file keeps the previous one.
        if not exists(directory .. '/' .. id .. '.webm') then return end
        local settings = obs.obs_data_create()
        load_timing()
        obs.obs_data_set_string(settings, 'path', directory .. '/' .. id .. '.webm')
        obs.obs_data_set_int(settings, 'tp_type', 0)
        obs.obs_data_set_int(settings, 'transition_point', cut_ms)
        obs.obs_data_set_bool(settings, 'hw_decode', false) -- VP9 software decoder preserves alpha.
        obs.obs_data_set_bool(settings, 'preload', false) -- Avoid full-frame RAM spikes.
        obs.obs_data_set_bool(settings, 'track_matte_enabled', false)
        obs.obs_data_set_int(settings, 'audio_fade_style', 1)
        obs.obs_source_update(source, settings)
        obs.obs_data_release(settings)
        last = id
        obs.script_log(obs.LOG_INFO, 'Next spirit: ' .. id)
    end)
end

function spirit_tick()
    if not pending then obs.timer_remove(spirit_tick); return end
    if now() < deadline then return end
    if not selected() then pending = false; obs.timer_remove(spirit_tick); return end
    local busy = false
    with_target(function(source)
        local t = obs.obs_transition_get_time(source)
        busy = t > 0 and t < 1
    end)
    if busy then return end
    pending = false; obs.timer_remove(spirit_tick); queue_next()
end

function spirit_started()
    if enabled and selected() then
        -- Some OBS events occur at the cut; the video tail must finish as well.
        deadline = now() + tail_guard
        if not pending then obs.timer_add(spirit_tick, 100) end
        pending = true
    end
end

local function detach()
    if signal_handler then obs.signal_handler_disconnect(signal_handler, 'transition_start', spirit_started) end
    if attached then obs.obs_source_release(attached) end
    attached, signal_handler = nil, nil
end

local function attach()
    detach()
    with_target(function(source)
        attached = obs.obs_source_get_ref(source)
        signal_handler = obs.obs_source_get_signal_handler(source)
        obs.signal_handler_connect(signal_handler, 'transition_start', spirit_started)
    end)
end

function spirit_event(event)
    if event == obs.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGING then
        pending = false; obs.timer_remove(spirit_tick); bag = {}
        detach()
    elseif event == obs.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGED or
           event == obs.OBS_FRONTEND_EVENT_FINISHED_LOADING then
        if loaded then attach(); queue_next() end
    end
end

function script_description()
    return 'Four cinematic Udyr-inspired spirits. Select the native Stinger named Hub Spirit Transitions. '
        .. 'Every spirit plays once per shuffled cycle, with no back-to-back repeat. '
        .. 'Files change only after the full video finishes. Timing comes from the export manifest. Originals and scene overrides are preserved.'
end
function script_defaults(settings)
    obs.obs_data_set_default_string(settings, 'directory', 'C:/StreamingMedia/Transitions/udyr-spirits-v2')
    obs.obs_data_set_default_string(settings, 'transition_name', 'Hub Spirit Transitions')
    obs.obs_data_set_default_bool(settings, 'enabled', true)
end
function script_properties()
    local p = obs.obs_properties_create()
    obs.obs_properties_add_bool(p, 'enabled', 'Randomize spirits')
    obs.obs_properties_add_path(p, 'directory', 'Spirit video folder', obs.OBS_PATH_DIRECTORY, '', nil)
    obs.obs_properties_add_text(p, 'transition_name', 'Stinger transition name', obs.OBS_TEXT_DEFAULT)
    return p
end
function script_update(settings)
    directory = obs.obs_data_get_string(settings, 'directory'):gsub('\\', '/'):gsub('/$', '')
    target = obs.obs_data_get_string(settings, 'transition_name')
    enabled = obs.obs_data_get_bool(settings, 'enabled')
    bag = {}
    -- Settings edits during playback defer until the existing animation finishes.
    if loaded and not pending then attach(); queue_next() end
end
function script_load(settings)
    math.randomseed(os.time())
    script_update(settings); loaded = true
    obs.obs_frontend_add_event_callback(spirit_event)
    attach(); queue_next()
end
function script_unload()
    loaded = false; pending = false
    obs.timer_remove(spirit_tick)
    detach()
    obs.obs_frontend_remove_event_callback(spirit_event)
end
