import fsMod from 'node:fs';
import type { Plugin } from 'vite';
import type { AstroSettings } from '../@types/astro.js';
import { VIRTUAL_MODULE_ID } from './consts.js';
import {
	getContentEntryConfigByExtMap,
	getDataEntryExts,
	getContentPaths,
	getExtGlob,
	getStringifiedLookupMap,
} from './utils.js';
import { rootRelativePath } from '../core/util.js';

interface AstroContentVirtualModPluginParams {
	settings: AstroSettings;
}

export function astroContentVirtualModPlugin({
	settings,
}: AstroContentVirtualModPluginParams): Plugin {
	const contentPaths = getContentPaths(settings.config);
	const relContentDir = rootRelativePath(settings.config.root, contentPaths.contentDir);
	const relDataDir = rootRelativePath(settings.config.root, contentPaths.dataDir);

	const contentEntryConfigByExt = getContentEntryConfigByExtMap(settings);
	const contentEntryExts = [...contentEntryConfigByExt.keys()];
	const dataEntryExts = getDataEntryExts(settings);

	const virtualModContents = fsMod
		.readFileSync(contentPaths.virtualModTemplate, 'utf-8')
		.replace('@@CONTENT_DIR@@', relContentDir)
		.replace('@@DATA_DIR@@', relDataDir)
		.replace('@@CONTENT_ENTRY_GLOB_PATH@@', `${relContentDir}**/*${getExtGlob(contentEntryExts)}`)
		.replace('@@DATA_ENTRY_GLOB_PATH@@', `${relDataDir}**/*${getExtGlob(dataEntryExts)}`)
		.replace(
			'@@RENDER_ENTRY_GLOB_PATH@@',
			`${relContentDir}**/*${getExtGlob(
				contentEntryExts /** data collections excluded since they don't have a `render()` function */
			)}`
		);

	const astroContentVirtualModuleId = '\0' + VIRTUAL_MODULE_ID;

	return {
		name: 'astro-content-virtual-mod-plugin',
		enforce: 'pre',
		resolveId(id) {
			if (id === VIRTUAL_MODULE_ID) {
				return astroContentVirtualModuleId;
			}
		},
		async load(id) {
			const stringifiedLookupMap = await getStringifiedLookupMap({
				fs: fsMod,
				contentPaths,
				contentEntryConfigByExt,
				root: settings.config.root,
			});

			if (id === astroContentVirtualModuleId) {
				return {
					code: virtualModContents.replace(
						'/* @@LOOKUP_MAP_ASSIGNMENT@@ */',
						`lookupMap = ${stringifiedLookupMap};`
					),
				};
			}
		},
	};
}
