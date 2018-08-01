let Text = require('./Text'),
	Address = require('./Address'),
	Ref = require('./Ref'),
	Warning = require('./Warning');

// To parse for a specific text string
class TextParser {
	constructor( disassembly, addr ){
		this.disassembly = disassembly;
		this.addr = addr;
		
		// Pull some data from the disassembly
		this.ROM = disassembly.ROM;
		this.EOS = disassembly.EOS;
		this.ByteToChar = disassembly.ByteToChar;
		
		// Initialize the parser data
		this.index = addr;
		
		// Create the head Text node
		this.Head = this.Text = new Text( this, addr );
		
		// Begin parsing
		this.parse();
		
		this.finalize();
	}
	
	parse(){
		do {
			var value = this.ROM[this.index];
			
			if( this.ByteToChar.has(value) ){
				let ch = this.ByteToChar.get(value);
				this.Text.addContent(ch);
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
		
		if( this.disassembly.ParsedTexts.has(this.index) ){
			Warning(`Start of another string reached while parsing string at ${ Address.toBankString(this.addr, 'rom') }`);
			return false;
		}
		
		return true;
	}
	
	finalize(){
		this.Text.close( this.index );
		this.Head.store();
	}
}

module.exports = TextParser;