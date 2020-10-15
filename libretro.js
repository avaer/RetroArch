import * as THREE from './three.module.js';

const renderer = new THREE.WebGLRenderer({
  // canvas,
  // context,
  antialias: true,
  // alpha: true,
  // preserveDrawingBuffer: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = false;
renderer.sortObjects = false;
renderer.physicallyCorrectLights = true;
renderer.xr.enabled = true;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 2);
camera.rotation.order = 'YXZ';
// camera.quaternion.set(0, 0, 0, 1);

const mainMesh = (() => {
  const geometry = new THREE.PlaneBufferGeometry(1, 1);
  const texture = new THREE.Texture(document.getElementById('canvas'));
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
})();
mainMesh.position.y = 1;
scene.add(mainMesh);

renderer.setAnimationLoop(() => {
  mainMesh.material.map.needsUpdate = true;

  renderer.render(scene, camera);
});

const _initializeXr = () => {
  let currentSession = null;
  function onSessionStarted(session) {
    console.log('session started', session);
    session.addEventListener('end', onSessionEnded);
    renderer.xr.setSession(session);
    // renderer.xr.setReferenceSpaceType('local-floor');
    currentSession = session;
    // setState({ isXR: true })
  }
  function onSessionEnded() {
    currentSession.removeEventListener('end', onSessionEnded);
    renderer.xr.setSession(null);
    currentSession = null;
    // setState({ isXR: false })
  }
  /* document.getElementById('enter-xr-button').addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation(); */
    if (currentSession === null) {
      navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: [
          'local-floor',
          // 'bounded-floor',
        ],
        optionalFeatures: [
          'hand-tracking',
        ],
      }).then(onSessionStarted);
    } else {
      currentSession.end();
    }
  // });
};
// _initializeXr();

/**
 * RetroArch Web Player
 *
 * This provides the basic JavaScript for the RetroArch web player.
 */
// var BrowserFS = BrowserFS;
var afs;

function cleanupStorage()
{
   localStorage.clear();
   if (BrowserFS.FileSystem.IndexedDB.isAvailable())
   {
      var req = indexedDB.deleteDatabase("RetroArch");
      req.onsuccess = function () {
         console.log("Deleted database successfully");
      };
      req.onerror = function () {
         console.log("Couldn't delete database");
      };
      req.onblocked = function () {
         console.log("Couldn't delete database due to the operation being blocked");
      };
   }

   document.getElementById("btnClean").disabled = true;
}

function idbfsInit()
{
   return new Promise((accept, reject) => {
     $('#icnLocal').removeClass('fa-globe');
     $('#icnLocal').addClass('fa-spinner fa-spin');
     var imfs = new BrowserFS.FileSystem.InMemory();
     if (BrowserFS.FileSystem.IndexedDB.isAvailable())
     {
        afs = new BrowserFS.FileSystem.AsyncMirror(imfs,
           new BrowserFS.FileSystem.IndexedDB(function(e, fs)
        {
           if (e)
           {
              //fallback to imfs
              afs = new BrowserFS.FileSystem.InMemory();
              console.log("WEBPLAYER: error: " + e + " falling back to in-memory filesystem");
              setupFileSystem("browser").then(() => {
                preLoadingComplete();
                accept();
              });
           }
           else
           {
              // initialize afs by copying files from async storage to sync storage.
              afs.initialize(function (e)
              {
                 if (e)
                 {
                    afs = new BrowserFS.FileSystem.InMemory();
                    console.log("WEBPLAYER: error: " + e + " falling back to in-memory filesystem");
                    setupFileSystem("browser").then(() => {
                      preLoadingComplete();
                      accept();
                    });
                 }
                 else
                 {
                    idbfsSyncComplete();
                    accept();
                 }
              });
           }
        },
        "RetroArch"));
     }
   });
}

function idbfsSyncComplete()
{
   $('#icnLocal').removeClass('fa-spinner').removeClass('fa-spin');
   $('#icnLocal').addClass('fa-check');
   console.log("WEBPLAYER: idbfs setup successful");

   setupFileSystem("browser").then(() => {
     preLoadingComplete();
   });
}

function _getCoreNameForFileName(fileName) {
  const match = fileName.match(/\.([^\.]+)$/);
  const ext = match ? match[1].toLowerCase() : '';
  switch (ext) {
    case 'md':
      return 'genesis_plus_gx';
    case 'n64':
    case 'z64':
      // return 'parallel_n64';
      return 'parallel_n64';
    case 'cue':
      // return 'pcsx_rearmed';
      return 'pcsx_rearmed';
      // return 'mednafen_psx_hw';
    default: return null;
  }
}
function loadFiles(files) {
  const mainFile = files.find(file => /\.(?:md|n64|z64|cue)$/i.test(file.name));
  const mainFileName = mainFile ? mainFile.name : null;
  const core = mainFileName ? _getCoreNameForFileName(mainFileName) : null;
  if (core) {
   // Load the Core's related JavaScript.
   $.getScript(core + '_libretro.js', function ()
   {
      $('#icnRun').removeClass('fa-spinner').removeClass('fa-spin');
      $('#icnRun').addClass('fa-play');
      $('#lblDrop').removeClass('active');
      $('#lblLocal').addClass('active');
      idbfsInit().then(() =>
        Promise.all(
          files.map(file =>
            new Promise((accept, reject) => {
              const fr = new FileReader();
              fr.onload = () => {
                const fileData = fr.result;
                const fileName = file.name;

                const dataView = new Uint8Array(fileData);
                FS.createDataFile('/', fileName, dataView, true, false);

                const data = FS.readFile(fileName, {
                  encoding: 'binary'
                });
                const filePath = '/home/web_user/retroarch/userdata/content/' + fileName;
                FS.writeFile('/home/web_user/retroarch/userdata/content/' + fileName, data, {
                  encoding: 'binary'
                });
                FS.unlink(fileName);

                accept();
              };
              fr.onerror = err => {
                reject(err);
              };
              fr.readAsArrayBuffer(file);
            })
          )
        )
      ).then(() => {
        startRetroArch(['-v', '/home/web_user/retroarch/userdata/content/' + mainFileName]);
        
        _initializeXr();
      });
   });
  } else {
    const err = new Error('could not detect file for ' + mainFileName);
    console.warn(err);
  }
}

function preLoadingComplete()
{
   /* Make the Preview image clickable to start RetroArch. */
   $('.webplayer-preview').addClass('loaded').click(function () {
      startRetroArch();
      return false;
  });
  document.getElementById("btnRun").disabled = false;
  $('#btnRun').removeClass('disabled');
}
window.addEventListener('dragover', e => {
  e.preventDefault();
});
window.addEventListener('drop', e => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  loadFiles(files);
});

async function setupFileSystem(backend)
{
   /* create a mountable filesystem that will server as a root
      mountpoint for browserfs */
   var mfs =  new BrowserFS.FileSystem.MountableFileSystem();

   /* create an XmlHttpRequest filesystem for the bundled data */
   var xfs1 =  new BrowserFS.FileSystem.XmlHttpRequest
      (".index-xhr", "/assets/frontend/bundle/");
   /* create an XmlHttpRequest filesystem for core assets */
   var xfs2 =  new BrowserFS.FileSystem.XmlHttpRequest
      (".index-xhr", "/assets/cores/");

   console.log("WEBPLAYER: initializing filesystem: " + backend);
   mfs.mount('/home/web_user/retroarch/userdata', afs); 

   mfs.mount('/home/web_user/retroarch/bundle', xfs1);
   mfs.mount('/home/web_user/retroarch/userdata/content/downloads', xfs2);
   BrowserFS.initialize(mfs);
   var BFS = new BrowserFS.EmscriptenFS();
   FS.mount(BFS, {root: '/home'}, '/home');
   console.log("WEBPLAYER: " + backend + " filesystem initialization successful");

   // window.FS = FS;
   try {
     const config = FS.readFile('/home/web_user/retroarch/userdata/retroarch.cfg', {encoding: 'utf8'});
     console.log('got old config', config);
   } catch(err) {
     console.warn(err);
   }
   const res = await fetch('./retroarch.cfg');
   const text = await res.text();
   FS.writeFile('/home/web_user/retroarch/userdata/retroarch.cfg', text, {
     encoding: 'binary',
   });
   /* window.mfs = mfs;
   const _recurse = () => new Promise((accept, reject) => {
     try {
       const cfgFile = mfs.readFileSync('/home/web_user/retroarch/userdata/retroarch.cfg', null, {pathExistsAction(){return 0;},isReadable(){return true}});
       const cfgFileData = cfgFile.data.buff.buffer;
       accept(cfgFileData);
     } catch(err) {
       setTimeout(_recurse);
     }
   });
   _recurse()
     .then(a => {
       console.log('got cfg file data', a);
     }); */
}

/**
 * Retrieve the value of the given GET parameter.
 */
function getParam(name) {
  var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
  if (results) {
    return results[1] || null;
  }
}

function startRetroArch(args)
{
   $('.webplayer').show();
   $('.webplayer-preview').hide();
   document.getElementById("btnRun").disabled = true;

   $('#btnFullscreen').removeClass('disabled');
   $('#btnMenu').removeClass('disabled');
   $('#btnAdd').removeClass('disabled');
   $('#btnRom').removeClass('disabled');

   document.getElementById("btnAdd").disabled = false;
   document.getElementById("btnRom").disabled = false;
   document.getElementById("btnMenu").disabled = false;
   document.getElementById("btnFullscreen").disabled = false;

   // console.log('arguments', Module['arguments']);

   Module['arguments'] = args;

   Module['callMain'](Module['arguments']);
   document.getElementById('canvas').focus();
}

function selectFiles(files)
{
   $('#btnAdd').addClass('disabled');
   $('#icnAdd').removeClass('fa-plus');
   $('#icnAdd').addClass('fa-spinner spinning');
   var count = files.length;

   for (var i = 0; i < files.length; i++)
   {
      filereader = new FileReader();
      filereader.file_name = files[i].name;
      filereader.readAsArrayBuffer(files[i]);
      filereader.onload = function(){uploadData(this.result, this.file_name)};
      filereader.onloadend = function(evt)
      {
         console.log("WEBPLAYER: file: " + this.file_name + " upload complete");
         if (evt.target.readyState == FileReader.DONE)
         {
            $('#btnAdd').removeClass('disabled');
            $('#icnAdd').removeClass('fa-spinner spinning');
            $('#icnAdd').addClass('fa-plus');
         }
       }
   }
}

function uploadData(data,name)
{
   var dataView = new Uint8Array(data);
   FS.createDataFile('/', name, dataView, true, false);

   var data = FS.readFile(name,{ encoding: 'binary' });
   FS.writeFile('/home/web_user/retroarch/userdata/content/' + name, data ,{ encoding: 'binary' });
   FS.unlink(name);
}

function switchCore(corename) {
   localStorage.setItem("core", corename);
}

function switchStorage(backend) {
   if (backend != localStorage.getItem("backend"))
   {
      localStorage.setItem("backend", backend);
      location.reload();
   }
}

// When the browser has loaded everything.
$(function() {
  globalThis.Module = {
    noInitialRun: true,
    arguments: ["-v", "--menu"],
    preRun: [],
    postRun: [],
    print: function(text)
    {
       console.log(text);
    },
    printErr: function(text)
    {
       console.log(text);
    },
    canvas: document.getElementById('canvas'),
    totalDependencies: 0,
    monitorRunDependencies: function(left)
    {
       this.totalDependencies = Math.max(this.totalDependencies, left);
    }
  };
  
   // Enable all available ToolTips.
   $('.tooltip-enable').tooltip({
      placement: 'right'
   });

   // Allow hiding the top menu.
   $('.showMenu').hide();
   $('#btnHideMenu, .showMenu').click(function () {
      $('nav').slideToggle('slow');
      $('.showMenu').toggle('slow');
   });

   /**
    * Attempt to disable some default browser keys.
    */
	var keys = {
    9: "tab",
    13: "enter",
    16: "shift",
    18: "alt",
    27: "esc",
    33: "rePag",
    34: "avPag",
    35: "end",
    36: "home",
    37: "left",
    38: "up",
    39: "right",
    40: "down",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12"
  };
	window.addEventListener('keydown', function (e) {
    if (keys[e.which]) {
      e.preventDefault();
    }
  });

   // Switch the core when selecting one.
   $('#core-selector a').click(function () {
      var coreChoice = $(this).data('core');
      switchCore(coreChoice);
   });
 });

function keyPress(k)
{
   kp(k, "keydown");
   setTimeout(function(){kp(k, "keyup")}, 50);
}

var kp = function(k, event) {
   var oEvent = new KeyboardEvent(event, { code: k });

   document.dispatchEvent(oEvent);
   document.getElementById('canvas').focus();
}
