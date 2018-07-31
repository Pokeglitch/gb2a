let Address = require('./Address'),
	Ref = require('./Ref'),
	Warning = require('./Warning');

class StringParser {
	constructor( disassembly, addr, isSplit ){
		this.disassembly = disassembly;
		this.addr = addr;
		
		// Pull some data from the disassembly
		this.EOS = disassembly.EOS;
		this.ByteToChar = disassembly.ByteToChar;
		
		this.ROM = disassembly.ROM;
		this.index = addr;
		this.chars = [];
		
		if( !isSplit ){
			this.parse();
		}
		
		this.after_addr = this.index;
	}
	
	split( addr ){
		let other = new StringParser( this.disassembly, addr, true );
		
		other.after_addr = this.after_addr;
		this.after_addr = addr;
		
		other.chars = this.chars.splice( addr - this.addr );
		
		return other;
	}
	
	// To have the same interface as Routine
	getTail(){
		return this;
	}
	
	parse(){
		do {
			var value = this.ROM[this.index];
			
			if( this.ByteToChar.has(value) ){
				this.chars.push( this.ByteToChar.get(value) );
			}
			else{
				Warning(`Unmapped char (0x${ Address.format(value, 2) }) encountered while parsing string at ${ Address.toBankString(this.addr, 'rom') }`);
				break;
			}
			
			this.index += 1;
		} while( this.doContinue(value) );
	}
	
	/* Don't continue if:
		- the value is an EOS symbol
		- the bank has ended
		- the address is a routine 
		- the address is a string
	*/
	doContinue(value){
		if( this.EOS.has(value) ){
			return false;
		}
		if( !(this.index % 0x4000) ){
			Warning(`End of bank reached while parsing string at ${ Address.toBankString(this.addr, 'rom') }`);
			return false;
		}
		
		if( this.disassembly.ROMRefs.get(this.index) === Ref.MAIN ){
			Warning(`Start of routine reached while parsing string at ${ Address.toBankString(this.addr, 'rom') }`);
			return false;
		}
		
		if( this.disassembly.ParsedStrings.has(this.index) ){
			Warning(`Start of another string reached while parsing string at ${ Address.toBankString(this.addr, 'rom') }`);
			return false;
		}
		
		return true;
	}
	
	compile( dis, asm ){
		let labels = dis.getName( this.addr, 'rom', true );
		
		labels.forEach( (x,i) => {
			let label = x + ':';
			if( i === 0 ){
				label += ' ; ' + Address.toBankString( this.addr, 'rom' );
			}
			asm.write( label + '\n' );
		})
		
		asm.write( '\tdb "' + this.chars.join('') + '"\n' );
	}
}

module.exports = StringParser;