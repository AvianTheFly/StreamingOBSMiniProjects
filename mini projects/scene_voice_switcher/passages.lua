-- Native transitions between locations inside Lobbies. No sockets, workers or timers.
-- OBS owns this script's lifetime; Hub scene routing continues to own the choice.
obs = obslua
local root = 'Lobbies'
local prefix = 'Hub Lobby Passage: '
local style, duration = 'iris', 950
local names = {}
local originals = {}
local presets = {
    dissolve = {label='Cinematic dissolve', id='fade_transition'},
    iris = {label='Celestial aperture', id='wipe_transition', mask='iris.png', softness=.08},
    gates = {label='Stormglass gates', id='wipe_transition', mask='barndoor-h.png', softness=.045},
    embers = {label='Ember veil', id='wipe_transition', mask='watercolor.png', softness=.1}
}

local function owned(data)
    return string.sub(obs.obs_data_get_string(data, 'name'), 1, #prefix) == prefix
end

local function apply(clear)
    local source = obs.obs_get_source_by_name(root)
    if not source then return end
    local scene = obs.obs_scene_from_source(source)
    if not scene then obs.obs_source_release(source); return end
    local items = obs.obs_scene_enum_items(scene)
    local spec = presets[style]
    local managed, preserved = 0, 0
    for _, item in ipairs(items or {}) do
        local name = obs.obs_source_get_name(obs.obs_sceneitem_get_source(item))
        if names[name] then
            for _, show in ipairs({true, false}) do
                local previous = obs.obs_sceneitem_transition_save(item, show)
                -- Personal show/hide transitions have priority and are never overwritten.
                if owned(previous) or obs.obs_data_get_string(previous, 'id') == '' then
                    local key = name .. (show and ':show' or ':hide')
                    if clear then
                        if owned(previous) then
                            local saved = obs.obs_data_create_from_json(originals[key] or '{"duration":0}')
                            obs.obs_sceneitem_transition_load(item, saved, show)
                            obs.obs_data_release(saved)
                        end
                    else
                        if not originals[key] and not owned(previous) then originals[key] = obs.obs_data_get_json(previous) end
                        local settings = obs.obs_data_create()
                        if spec.mask then
                            obs.obs_data_set_string(settings, 'luma_image', spec.mask)
                            obs.obs_data_set_double(settings, 'luma_softness', spec.softness)
                            obs.obs_data_set_bool(settings, 'luma_invert', false)
                        end
                        local transition = obs.obs_source_create_private(spec.id, prefix .. spec.label, settings)
                        if transition then
                            obs.obs_sceneitem_set_transition(item, show, transition)
                            obs.obs_sceneitem_set_transition_duration(item, show, duration)
                            obs.obs_source_release(transition)
                            managed = managed + 1
                        end
                        obs.obs_data_release(settings)
                    end
                else
                    preserved = preserved + 1
                end
                obs.obs_data_release(previous)
            end
        end
    end
    if items then obs.sceneitem_list_release(items) end
    obs.obs_source_release(source)
    if not clear then obs.script_log(obs.LOG_INFO, string.format('Lobby passages applied: style=%s duration=%d managed=%d personal=%d', style, duration, managed, preserved)) end
end

local function frontend(event)
    if event == obs.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGING then
        apply(true)
        originals = {}
    elseif event == obs.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGED or event == obs.OBS_FRONTEND_EVENT_FINISHED_LOADING then
        apply(false)
    end
end

function script_description()
    return 'Native handoffs between your lobby locations. Choose a cinematic dissolve, celestial aperture, stormglass gates or ember veil. Camera, chat, filters and layouts stay intact. Existing personal item transitions take priority. Full scene changes keep your eight spirit performances.'
end

function script_properties()
    local p = obs.obs_properties_create()
    local list = obs.obs_properties_add_list(p, 'style', 'Lobby passage', obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    for _, key in ipairs({'dissolve','iris','gates','embers'}) do obs.obs_property_list_add_string(list, presets[key].label, key) end
    obs.obs_properties_add_int(p, 'duration', 'Duration (milliseconds)', 250, 2000, 50)
    return p
end

function script_defaults(settings)
    obs.obs_data_set_default_string(settings, 'style', 'iris')
    obs.obs_data_set_default_int(settings, 'duration', 950)
end

function script_update(settings)
    local choice = obs.obs_data_get_string(settings, 'style')
    if not presets[choice] then return end
    style = choice
    duration = math.max(250, math.min(2000, obs.obs_data_get_int(settings, 'duration')))
    names = {}
    for name in string.gmatch(obs.obs_data_get_string(settings, 'locations'), '[^|]+') do names[name] = true end
    apply(false)
end

function script_load(settings)
    script_update(settings)
    obs.obs_frontend_add_event_callback(frontend)
end

function script_unload()
    obs.obs_frontend_remove_event_callback(frontend)
    apply(true)
end
