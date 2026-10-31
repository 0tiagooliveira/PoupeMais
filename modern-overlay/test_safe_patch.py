"""Offline regression tests for the Firebase Hosting PATCH process.

Never uses OAuth credentials or accesses the user's financial data.
"""
import importlib.util
import pathlib
import sys
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('safe_patch', pathlib.Path(__file__).with_name('deploy-modern-pierre-rest.py'))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SafePatchTest(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.file_map = {'/index.html': 'a'*64, '/assets/app.js':'b'*64}
        self.file_map.update({f'/assets/extra-{i}.js':f'{i:064x}' for i in range(220)})
        self.version = 'sites/poupe-mais-6a07f/versions/restored-modern'
        self.changed = {
            '/index.html':b'<html></html>',
            '/assets/app.js':b'patched',
            '/assets/chunks/chunk-GX4UVSAK.js':b'correct-firebase',
            '/assets/chunks/chunk-ZRRIDQRF.js':b'protected-balance',
            '/pierre.html':b'<main>Pierre</main>',
            '/pierre-import.js':b'/*safe importer*/',
            '/pierre-nav.js':b'/*safe nav*/',
        }

    def fake_call(self, token, method, path, payload=None, binary=None):
        self.calls.append((method,path,payload,binary))
        if method=='GET' and '/releases?' in path:
            return {'releases':[{'version':{'name':self.version}}]}
        if method=='GET' and path=='/'+self.version:
            return {'name':self.version,'config':{'rewrites':[{'glob':'**','path':'/index.html'}]}}
        if method=='GET' and path.startswith('/'+self.version+'/files'):
            return {'files':[{'path':p,'hash':v,'status':'ACTIVE'} for p,v in self.file_map.items()]}
        if method=='POST' and path.endswith('/versions'):
            return {'name':'sites/poupe-mais-6a07f/versions/new-modern'}
        if method=='POST' and path.endswith(':populateFiles'):
            self.new_files=payload['files']
            self.assertTrue(all(self.new_files[x]==self.file_map[x] for x in self.file_map if x not in self.changed))
            return {'uploadUrl':'https://upload-firebasehosting.googleapis.com/upload/test','uploadRequiredHashes':
                [self.new_files[x] for x in self.changed]}
        return {}

    def run_cli(self, do_publish=False):
        args=['rest.py']+(['--publish'] if do_publish else [])
        with patch.object(MODULE,'access_token',return_value='fake-token'),\
             patch.object(MODULE,'call',side_effect=self.fake_call),\
             patch.object(MODULE,'changes',return_value=self.changed),\
             patch.object(sys,'argv',args):
            MODULE.main()

    def test_default_is_read_only(self):
        self.run_cli()
        self.assertTrue(self.calls)
        self.assertTrue(all(call[0]=='GET' for call in self.calls))

    def test_publish_preserves_all_existing_paths(self):
        self.run_cli(do_publish=True)
        self.assertEqual(len(self.new_files),len(self.file_map)+len(set(self.changed)-set(self.file_map)))
        self.assertTrue(all(path in self.new_files for path in self.file_map))
        self.assertTrue(any(m=='PATCH' and 'update_mask=status' in p for m,p,_,_ in self.calls))
        self.assertTrue(any(m=='POST' and '/releases?versionName=' in p for m,p,_,_ in self.calls))

    def test_missing_modern_release_fails_closed(self):
        self.file_map={'/index.html':'a'*64,'/assets/app.js':'b'*64}
        with self.assertRaises(MODULE.APIError):self.run_cli()
        self.assertTrue(all(m=='GET' for m,_,_,_ in self.calls))


    def test_existing_navigation_is_not_injected_twice(self):
        markup = '<html><body><script defer src="/pierre-nav.js"></script></body></html>'
        with patch.object(MODULE, 'public', side_effect=AssertionError('Unexpected network request')):
            output = MODULE.clean_existing_page_scripts(markup)
        self.assertEqual(output.count('pierre-nav.js'), 1)

    def test_identical_insights_scripts_are_deduplicated(self):
        markup = ('<html><body><script src="/pierre-nav.js"></script>'
                  '<script src="/pierre-insights.js?v=20261030-5"></script>'
                  '<script src="/pierre-insights.js?v=20261030-4"></script></body></html>')
        with patch.object(MODULE, 'public', return_value=b'identical JavaScript'):
            output = MODULE.clean_existing_page_scripts(markup)
        self.assertIn('pierre-insights.js?v=20261030-5', output)
        self.assertNotIn('pierre-insights.js?v=20261030-4', output)
        self.assertEqual(output.count('pierre-nav.js'), 1)

    def test_different_insights_scripts_abort_without_modifying_site(self):
        markup = ('<html><body><script src="/pierre-nav.js"></script>'
                  '<script src="/pierre-insights.js?v=20261030-5"></script>'
                  '<script src="/pierre-insights.js?v=20261030-4"></script></body></html>')
        with patch.object(MODULE, 'public', side_effect=[b'old JS', b'new JS']):
            with self.assertRaises(MODULE.APIError):
                MODULE.clean_existing_page_scripts(markup)


if __name__=='__main__':
    unittest.main(verbosity=2)