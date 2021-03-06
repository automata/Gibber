define([], function() {
    return {
		init: function(gibberish) {			
			gibberish.generators.Synth = gibberish.createGenerator(["frequency", "amp", "attack", "decay", "pan", "channels"], "{0}( {1}, {2}, {3}, {4}, {5}, {6} )");
			gibberish.make["Synth"] = this.makeSynth;
			gibberish.Synth = this.Synth;
			
			gibberish.PolySynth = this.PolySynth;
			
			gibberish.generators.FMSynth = gibberish.createGenerator(["frequency", "cmRatio", "index", "attack", "decay", "amp", "channels", "pan" ], "{0}( {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8})");
			gibberish.make["FMSynth"] = this.makeFMSynth;
			gibberish.FMSynth = this.FMSynth;
			
			gibberish.PolyFM = this.PolyFM;
			
			gibberish.generators.Synth2 = gibberish.createGenerator(["frequency", "amp", "attack", "decay", "sustain", "release", "attackLevel", "sustainLevel", "cutoff", "resonance", "filterMult", "isLowPass", "pan", "channels"], "{0}( {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9}, {10}, {11}, {12}, {13}, {14} )");
			gibberish.make["Synth2"] = this.makeSynth2;
			gibberish.Synth2 = this.Synth2;
			
			gibberish.generators.Mono = gibberish.createGenerator(["frequency", "amp1", "amp2", "amp3", "attack", "decay", "cutoff", "resonance", "filterMult", "isLowPass", "amp", "detune2", "detune3", "octave2", "octave3", "pan", "channels"], "{0}( {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9}, {10}, {11}, {12}, {13}, {14}, {15}, {16}, {17} )");
			gibberish.make["Mono"] = this.makeMono;
			gibberish.Mono = this.Mono;
			
			gibberish.PolySynth2 = this.PolySynth2;
		},
		
		Synth : function(properties) {
			var that = { 
				type:		"Synth",
				category:	"Gen",
				waveform:	"Triangle",
				amp:		.5,				
				attack:		22050,
				decay:		22050,
				frequency:	0,
				glide:		0,
				pan: 		0,
				channels:	1,
				
				note : function(_frequency) {
					if(typeof this.frequency === "object") {
						prevFreq = this.frequency.operands[0];
					}else{
						prevFreq = this.frequency;
					}
					
					this.frequency = _frequency;
					this.function.setFrequency(this.frequency);
					this.env.setState(0);
					this.env.setPhase(0);
				
					if(this.glide > 0) {
						this.mod("frequency", Line(_frequency - prevFreq, 0, this.glide), "-");
					
						var oldMod = this.mods[this.mods.length - 1];
						
						var me = this;
						future( function() { me.removeMod(oldMod) }, this.glide );
					}
					
				},
			};
			
			Gibberish.extend(that, new Gibberish.ugen(that));
			
			if(typeof properties !== "undefined") {
				Gibberish.extend(that, properties);
			}
			
			that.env = Gibberish.make["Env"](that.attack, that.decay);
			that.osc = Gibberish.make[that.waveform](that.frequency, that.amp);
			that.symbol = Gibberish.generateSymbol(that.type);
			Gibberish.masterInit.push(that.symbol + " = Gibberish.make[\"Synth\"]();");	
			that.function = Gibberish.make["Synth"](that.osc, that.env); // only passs ugen functions to make
			window[that.symbol] = that.function;
			
			Gibberish.defineProperties( that, ["frequency", "amp", "attack", "decay", "pan", "channels"] );
			
			var waveform = that.waveform;
		    Object.defineProperty(that, "waveform", {
				get: function() { return waveform; },
				set: function(value) {
					if(waveform !== value) {
						waveform = value;
						that.osc = Gibberish.make[value]();
						that.function.setOscillator(that.osc);
						Gibberish.dirty(that);
					}
				},
			});

			
			return that;
		},
		
		makeSynth: function(osc, env) { // note, storing the increment value DOES NOT make this faster!
			var phase = 0;
			var _frequency = 0;
			var panner = Gibberish.pan3();
			var out = [0,0];
			
			var output = function(frequency, amp, attack, decay, pan, channels ) {
				if(env.getState() < 2) {
					var val =  osc(frequency, amp, 1)[0] * env(attack, decay);
					out[0] = out[1] = val;
					return channels === 1 ? out : panner(val, pan, out);
				}
				return out;
			}
			
			output.setFrequency = function(freq) 	{ _frequency = freq; };
			output.getFrequency = function() 		{ return _frequency; };
			output.setOscillator = function(_osc) 	{ osc = _osc; };			
			
			return output;
		},
		
		PolySynth : function(properties) {
			var that = Gibberish.Bus();
			
			Gibberish.extend(that, {
				waveform:		"Triangle",
				amp:			.5,
				attack:			10000,
				decay:			10000,
				maxVoices:		5,
				voiceCount:		0,
				glide:			0,
				mod:			Gibberish.polyMod,
				removeMod:		Gibberish.removePolyMod,
				pan:			0,
				
				note : function(_frequency) {
					var synth = this.children[this.voiceCount++];
					if(this.voiceCount >= this.maxVoices) this.voiceCount = 0;
					
					synth.note(_frequency);
					
					return synth;
				},
			});
			
			if(typeof properties !== "undefined") {
				Gibberish.extend(that, properties);
			}
			
			that.children = [];
			
			for(var i = 0; i < that.maxVoices; i++) {
				var props = {
					attack: 	that.attack,
					decay:		that.decay,
					waveform:	that.waveform, 
					amp: 		1,
					pan: 		0,
				};
				
				var synth = this.Synth(props);
				synth.send(that, 1);

				that.children.push(synth);
			}
			
			Gibberish.polyDefineProperties( that, ["waveform", "attack", "decay", "glide", "pan"] );
			
			// (function() {
			// 	var _amp = that.amp;
			// 	Object.defineProperty(that, "amp", {
			// 		get: function() { return _amp; },
			// 		set: function(value) {
			// 			_amp = value;
			// 			that.send(Master, value);
			// 		},
			// 	});
			// })();
			
			return that;
		},
		
		FMSynth : function(properties) {
			var that = { 
				type:		"FMSynth",
				category:	"Gen",
				amp:		.25,
				cmRatio:	2,
				index:		5,			
				attack:		22050,
				decay:		22050,
				frequency:	0,
				glide: 		0,
				pan:		0,
				channels:	1,
				
				note : function(frequency, amp) {
					if(typeof this.frequency === "object" && this.frequency.type !== "OP") {
						prevFreq = this.frequency.operands[0];
					}else{
						prevFreq = this.frequency;
					}
					
					this.frequency = frequency;
					this.function.setFrequency(frequency);
					
					if(typeof amp !== 'undefined') this.amp = amp;
					
					this.env.setState(0);
					this.env.setPhase(0);
					
					if(this.glide > 0) {
						this.mod("frequency", Line(frequency - prevFreq, 0, this.glide), "-");
					
						var oldMod = this.mods[this.mods.length - 1];
						
						var me = this;
						future( function() { me.removeMod(oldMod) }, this.glide );
					}
				},
			};
			Gibberish.extend(that, new Gibberish.ugen(that));
			
			that.env = Gibberish.make["Env"]();
			that.carrier = Gibberish.make["Sine"]();
			that.modulator = Gibberish.make["Sine"]();
			
			that.symbol = Gibberish.generateSymbol(that.type);
			Gibberish.masterInit.push(that.symbol + " = Gibberish.make[\"FMSynth\"]();");
			that.function = Gibberish.make["FMSynth"](that.carrier, that.modulator, that.env, that.out);
			window[that.symbol] = that.function;
						
			Gibberish.defineProperties( that, ["amp", "attack", "decay", "cmRatio", "index", "frequency", "channels", "pan"] );
			if(typeof properties !== "undefined") {
				Gibberish.extend(that, properties);
			}
			
			return that;
		},
		
		makeFMSynth: function(carrier, modulator, envelope) { // note, storing the increment value DOES NOT make this faster!	
			var phase = 0;
			var _frequency = 0; // needed for polyfm
			var panner = Gibberish.pan3();
			var out = [0,0];

			var output = function(frequency, cmRatio, index, attack, decay, amp, channels, pan) {
				if(envelope.getState() < 2) {				
					var env = envelope(attack, decay);
					var mod = modulator(frequency * cmRatio, frequency * index, 1, 1)[0] * env;
					var val = carrier( frequency + mod, 1, 1 )[0] * env * amp;
					//if(phase++ % 22050 === 0) console.log("MOD AMOUNT", mod, cmRatio, index, frequency, out);
					out[0] = out[1] = val;
					return channels === 1 ? out : panner(val, pan, out);
				}else{
					out[0] = out[1] = 0;
					return out;
				}
			}
			output.setFrequency = function(freq) { _frequency = freq; };
			output.getFrequency = function() { return _frequency; }
			
			return output;
		},
		
		PolyFM : function(properties) {
			var that = Gibberish.Bus();
				
			Gibberish.extend(that, {
				amp:		 	.25,
				cmRatio:		2,
				index:		 	5,			
				attack:			22050,
				decay:			22050,
				maxVoices:		5,
				voiceCount:		0,
				glide:			0,
				mod:			Gibberish.polyMod,
				removeMod:		Gibberish.removePolyMod,
				pan:			0,
				amp:			1,
				
				note : function(_frequency, amp) {
					var synth = this.children[this.voiceCount++];
					if(this.voiceCount >= this.maxVoices) this.voiceCount = 0;
					synth.note(_frequency, amp);
				},
			});
			
			if(typeof properties !== "undefined") {
				Gibberish.extend(that, properties);
			}
			
			that.children = [];
			
			for(var i = 0; i < that.maxVoices; i++) {
				var props = {
					attack: 	that.attack,
					decay:		that.decay,
					cmRatio:	that.cmRatio,
					index:		that.index,
					amp: 		1,
				};
				
				var synth = this.FMSynth(props);
				synth.send(that, 1);

				that.children.push(synth);
			}
			
			Gibberish.polyDefineProperties( that, ["cmRatio", "index", "attack", "decay", "glide"] );
			
			// (function() {
			// 	var _amp = that.amp;
			// 	Object.defineProperty(that, "amp", {
			// 		get: function() { return _amp; },
			// 		set: function(value) {
			// 			_amp = value;
			// 			that.send(Master, value);
			// 		},
			// 	});
			// })();
			
			return that;
		},		
		
		Synth2 : function(properties) {
			var that = { 
				type:			"Synth2",
				category:		"Gen",
				waveform:		"Triangle",
				amp:			.1,
				attack:			10000,
				decay:			10000,
				release:		10000,
				sustain: 		null,
				attackLevel:  	1,
				sustainLevel: 	.5,
				cutoff:			.2,
				resonance:		2.5,
				filterMult:		.3,
				isLowPass:		true,
				frequency:		0,
				glide:			0,
				pan:			0,
				channels: 		1,
				
				note : function(_frequency) {
					if(typeof this.frequency === "object") {
						prevFreq = this.frequency.operands[0];
					}else{
						prevFreq = this.frequency;
					}
					this.frequency = _frequency;
					this.function.setFrequency(_frequency);
					if(this.env.getState() > 1) this.env.setState(0);
					
					if(this.glide > 0) {
						this.mod("frequency", Line(_frequency - prevFreq, 0, this.glide), "-");
					
						var oldMod = this.mods[this.mods.length - 1];
						
						var me = this;
						future( function() { me.removeMod(oldMod) }, this.glide );
					}	
				},
			};
			
			if(typeof properties !== "undefined") {
				Gibberish.extend(that, properties);
			}
			Gibberish.extend(that, new Gibberish.ugen(that));
			
			//that.env = Gibberish.make["ADSR"](that.attack, that.decay, that.sustain, that.release, that.attackLevel, that.sustainLevel);
			that.env = Gibberish.make["Env"](that.attack, that.decay); //, that.sustain, that.release, that.attackLevel, that.sustainLevel);
			that.osc = Gibberish.make[that.waveform](that.frequency, that.amp);
			
			var f = Gibberish.Filter24(that.cutoff, that.resonance, that.isLowPass);
			that.filter = f.function; 

			that.symbol = Gibberish.generateSymbol(that.type);
			Gibberish.masterInit.push(that.symbol + " = Gibberish.make[\"Synth2\"]();");	
			that.function = Gibberish.make["Synth2"](that.osc, that.env, that.filter);
			window[that.symbol] = that.function;
			
			Gibberish.defineProperties( that, ["frequency", "amp", "attack","decay","sustain","release","attackLevel","sustainLevel","cutoff","resonance","filterMult", "waveform", "isLowPass", "pan", "channels"] );
			
			var waveform = that.waveform;
		    Object.defineProperty(that, "waveform", {
				get: function() { return waveform; },
				set: function(value) {
					if(waveform !== value) {
						waveform = value;
						that.osc = Gibberish.make[value]();
						Gibberish.dirty(that);
					}
				},
			});
			
			return that;
		},
		
		makeSynth2: function(osc, env, filter) {
			var phase = 0;
			var _frequency = 0;
			var panner = Gibberish.pan3();
			var out = [0,0];
			
			var output = function(frequency, amp, attack, decay, sustain, release, attackLevel, sustainLevel, cutoff, resonance, filterMult, isLowPass, pan, channels) {
				if(env.getState() < 2) {				
					var envResult = env(attack, decay);
					var val = filter( osc(frequency, amp, 1), cutoff + filterMult * envResult, resonance, isLowPass, channels)[0] * envResult;
					out[0] = out[1] = val;
					return channels === 1 ? out : panner(val, pan, out);
				}
				out[0] = out[1] = 0;
				return out;
			};
			output.setFrequency = function(freq) {
				_frequency = freq;
			};
			output.getFrequency = function() { return _frequency; }
			
			return output;
		},
		
		PolySynth2 : function(properties) {
			var that = Gibberish.Bus();
				
			Gibberish.extend(that, {
				waveform:		"Triangle",
				amp:			.25,				
				attack:			10000,
				decay:			10000,
				release:		10000,
				sustain: 		null,
				attackLevel:  	1,
				sustainLevel: 	.5,
				cutoff:			.1,
				resonance:		2.5,
				filterMult:		 .3,
				isLowPass:		true,
				maxVoices:		5,
				voiceCount:		0,
				glide:			0,
				mod:			Gibberish.polyMod,
				removeMod:		Gibberish.removePolyMod,
					
				note : function(_frequency) {
					var synth = this.children[this.voiceCount++];
					if(this.voiceCount >= this.maxVoices) this.voiceCount = 0;
					synth.note(_frequency);
				},
			});
			
			if(typeof properties !== "undefined") {
				Gibberish.extend(that, properties);
			}
			
			that.children = [];
			
			for(var i = 0; i < that.maxVoices; i++) {
				var props = {
					attack: 		  that.attack,
					decay:			  that.decay,
					release:		  that.release,
					sustain:		  that.sustain,
					attackLevel:	that.attackLevel,
					sustainLevel:	that.sustainLevel,	
					cutoff:			  that.cutoff,
					resonance:		that.resonance,
					filterMult:		that.filterMult,
					isLowPass:		that.isLowPass,
					glide:			  that.glide,
          waveform:     that.waveform,
					amp: 			    1,
				};
				
				var synth = this.Synth2(props);
				synth.send(that, 1);

				that.children.push(synth);
			}
			
			Gibberish.polyDefineProperties( that, ["frequency", "amp", "attack", "decay", "sustain", "release","attackLevel","sustainLevel","cutoff","resonance","filterMult", "waveform", "glide", "isLowPass"] );
			
			// (function() {
			// 	var _amp = that.amp;
			// 	Object.defineProperty(that, "amp", {
			// 		get: function() { return _amp; },
			// 		set: function(value) {
			// 			_amp = value;
			// 			that.send(Master, value);
			// 		},
			// 	});
			// })();
			
			return that;
		},
		
		Mono : function(properties) {
			var that = { 
				type:			"Mono",
				category:		"Gen",
				waveform:		"Saw",
				amp:		.6,
				amp1:			1,
				amp2:			1,
				amp3:			1,
				attack:			10000,
				decay:			10000,
				cutoff:			.2,
				resonance:		2.5,
				filterMult:		.3,
				isLowPass:		true,
				frequency:		0,
				frequency2:		0,
				frequency3:		0,
				detune2:		.01,
				octave2:		1,
				detune3:		-.01,
				octave3:		-1,
				glide:			0,
				pan:			0,
				channels:		1,
				
				note : function(_frequency) {
					var prevFreq, prevFreq2, prevFreq3
	
					prevFreq  = typeof this.frequency  === "object" ? this.frequency.operands[0]  : this.frequency;
					prevFreq2 = typeof this.frequency2 === "object" ? this.frequency2.operands[0] : this.frequency2;
					prevFreq3 = typeof this.frequency3 === "object" ? this.frequency3.operands[0] : this.frequency3;										
	
					this.frequency = _frequency;
					
					if(this.env.getState() > 0) this.env.setState(0);
					
					if(this.glide > 0) {
						this.mod("frequency", Line(_frequency - prevFreq, 0, this.glide), "-");
						var oldMod = this.mods[this.mods.length - 1];
						
						//if(typeof this.frequency2 === "object") console.log("ALERT");
						this.mod("frequency2", Line(this.frequency2 - prevFreq2, 0, this.glide), "-");
						var oldMod2 = this.mods[this.mods.length - 1];
						
						this.mod("frequency3", Line(this.frequency3 - prevFreq3, 0, this.glide), "-");						
						var oldMod3 = this.mods[this.mods.length - 1];
																	
						var me = this;
						future( function() { me.removeMod(oldMod); me.removeMod(oldMod2); me.removeMod(oldMod3); }, this.glide );
					}	
				},
			};
			
			if(typeof properties !== "undefined") {
				Gibberish.extend(that, properties);
			}
			Gibberish.extend(that, new Gibberish.ugen(that));
			
			that.env  = Gibberish.make["Env"](that.attack, that.decay);
			
			// have to instantiate object for init method to be called and arrays initialized
			var f = Gibberish.Filter24(that.cutoff, that.resonance, that.isLowPass);
			that.filter = f.function; 
			
			that.osc1 = Gibberish.make[that.waveform](that.frequency,  that.amp1);
			that.osc2 = Gibberish.make[that.waveform](that.frequency2, that.amp2);
			that.osc3 = Gibberish.make[that.waveform](that.frequency3, that.amp3);
			
			that.symbol = Gibberish.generateSymbol(that.type);
			Gibberish.masterInit.push(that.symbol + " = Gibberish.make[\"Mono\"]();");	
			that.function = Gibberish.make["Mono"]( that.osc1, that.osc2, that.osc3, that.env, that.filter );
			window[that.symbol] = that.function;
			
			Gibberish.defineProperties( that, ["amp", "frequency", "amp1", "amp2", "amp3", "attack", "decay", "cutoff", "resonance", "filterMult", "isLowPass", "detune2", "detune3", "octave2", "octave3", "pan", "channels"] );
			
			var waveform = that.waveform;
			Object.defineProperty(that, "waveform", {
				get: function() { return waveform; },
				set: function(value) {
					if(waveform !== value) {
						waveform = value;
						var _osc1 = that.osc1;
						var _osc2 = that.osc2;
						var _osc3 = that.osc3;
						
						that.osc1 = Gibberish.make[value]();
						//that.osc1.setPhase( _osc1.getPhase() );
						that.osc2 = Gibberish.make[value]();
						//that.osc2.setPhase( _osc2.getPhase() );
						that.osc3 = Gibberish.make[value]();
						//that.osc3.setPhase( _osc3.getPhase() );
						
						that.function.setOsc1(that.osc1);
						that.function.setOsc2(that.osc2);
						that.function.setOsc3(that.osc3);												

						Gibberish.dirty(that);
					}
				},
			});
			
			return that;
		},
		
		makeMono: function(osc1, osc2, osc3, env, filter, zeros) {
			var phase = 0;
			var panner = Gibberish.pan3();
			var out = [0,0];
			var output = function(frequency, amp1, amp2, amp3, attack, decay, cutoff, resonance, filterMult, isLowPass, masterAmp, detune2, detune3, octave2, octave3, pan, channels) {
				if(env.getState() < 2) {
					var frequency2 = frequency;
					if(octave2 > 0) {
						for(var i = 0; i < octave2; i++) {
							frequency2 *= 2;
						}
					}else if(octave2 < 0) {
						for(var i = 0; i > octave2; i--) {
							frequency2 /= 2;
						}
					}
					
					var frequency3 = frequency;
					if(octave3 > 0) {
						for(var i = 0; i < octave3; i++) {
							frequency3 *= 2;
						}
					}else if(octave3 < 0) {
						for(var i = 0; i > octave3; i--) {
							frequency3 /= 2;
						}
					}
				
					frequency2 += detune2 > 0 ? ((frequency * 2) - frequency) * detune2 : (frequency - (frequency / 2)) * detune2;
					frequency3 += detune3 > 0 ? ((frequency * 2) - frequency) * detune3 : (frequency - (frequency / 2)) * detune3;
							
					var oscValue = osc1(frequency, amp1, 1)[0] + osc2(frequency2, amp2, 1)[0] + osc3(frequency3, amp3, 1)[0];
					var envResult = env(attack, decay);
					var val = filter( [oscValue], cutoff + filterMult * envResult, resonance, isLowPass, 1)[0] * envResult;
					val *= masterAmp;
					out[0] = out[1] = val;
					return channels === 1 ? out : panner(val, pan, out);
				}else{
					out[0] = out[1] = 0;
					return out;
				}
			};
			output.setOsc1 = function(_osc) { osc1 = _osc; };
			output.setOsc2 = function(_osc) { osc2 = _osc; };
			output.setOsc3 = function(_osc) { osc3 = _osc; };						
	
			return output;
		},
		
    }
});